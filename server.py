from flask import Flask, request, jsonify
from transformers import pipeline, AutoProcessor, AutoModelForCausalLM
from PIL import Image
import traceback
import os
import torch
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Disable symlink warnings
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

# Configure logging
def setup_logging(app):
    """Setup application logging"""
    if not app.debug:
        # Create logs directory if it doesn't exist
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = RotatingFileHandler(
            'logs/api.log',
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('API startup')

# Available models
MODELS = {
    "blip-base": {
        "name": "BLIP Base",
        "model": "Salesforce/blip-image-captioning-base",
        "description": "Fast and lightweight (500MB)"
    },
    "blip-large": {
        "name": "BLIP Large",
        "model": "Salesforce/blip-image-captioning-large",
        "description": "More detailed captions (2GB)"
    },
    "vit-gpt2": {
        "name": "ViT-GPT2",
        "model": "nlpconnect/vit-gpt2-image-captioning",
        "description": "Alternative model (500MB)"
    },
    "florence-2": {
        "name": "Florence-2 Base",
        "model": "microsoft/Florence-2-base",
        "description": "High-quality captions (custom loader, ~1.5GB)",
        "type": "florence",
        "default_mode": "more_detailed",
        "modes": {
            "caption": "<CAPTION>",
            "more_detailed": "<MORE_DETAILED_CAPTION>",
            "ocr": "<OCR>",
            "dense": "<DENSE_CAPTION>",
            "od": "<OD>"
        }
    },
    "moondream-2": {
        "name": "Moondream2",
        "model": "vikhyatk/moondream2",
        "revision": "2025-06-21",
        "description": "Lightweight VLM (fast CPU, ~1-2GB RAM)",
        "type": "moondream",
        "default_mode": "caption",
        "modes": {
            "caption": "caption",
            "roast": "roast"
        }
    }
}

# Lightweight text-generation models
LLM_MODELS = {
    "smollm2-1.7b": {
        "name": "SmolLM2 1.7B Instruct",
        "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
        "description": "Tiny instruct model (fast CPU, ~1.5GB RAM)",
        "pad_token_id": 128000,
    },
    "phi3-mini": {
        "name": "Phi-3 Mini 4k",
        "model": "microsoft/Phi-3-mini-4k-instruct",
        "description": "Reasoning-focused small model (~3GB RAM)",
    },
    "gemma2-2b": {
        "name": "Gemma-2 2B IT",
        "model": "google/gemma-2-2b-it",
        "description": "Creative text, ~2GB RAM",
    },
    "qwen2.5-1.5b": {
        "name": "Qwen2.5 1.5B Instruct",
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "description": "Multilingual ultra-light (~1GB RAM)",
    },
    "tinyllama-1.1b": {
        "name": "TinyLlama 1.1B Chat",
        "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
        "description": "Very fast, basic chat (~1GB RAM)",
    },
}

# Florence prompt tags by mode
FLORENCE_TAGS = MODELS["florence-2"].get("modes", {})


def florence_prompt_for_mode(mode: str | None):
    """Map requested mode to Florence prompt token with sensible fallback."""
    default_mode = MODELS["florence-2"].get("default_mode", "more_detailed")
    return FLORENCE_TAGS.get(mode, FLORENCE_TAGS.get(default_mode, "<MORE_DETAILED_CAPTION>"))

def create_app():
    app = Flask(__name__)
    
    # Setup logging
    setup_logging(app)
    
    # Configure max content length for file uploads (50MB)
    app.config['MAX_CONTENT_LENGTH'] = 52428800
    
    # Cache for loaded models
    model_cache = {}
    llm_cache = {}
    
    def get_model(model_key="blip-base"):
        """Load and cache model"""
        if model_key not in model_cache:
            if model_key not in MODELS:
                model_key = "blip-base"

            info = MODELS[model_key]
            app.logger.info(f"Loading {info['name']}...")

            if info.get("type") == "florence":
                processor = AutoProcessor.from_pretrained(info["model"], trust_remote_code=True)
                model = AutoModelForCausalLM.from_pretrained(
                    info["model"], trust_remote_code=True, torch_dtype=torch.float32
                ).to("cpu")
                model_cache[model_key] = {
                    "type": "florence",
                    "processor": processor,
                    "model": model,
                }
            elif info.get("type") == "moondream":
                model = AutoModelForCausalLM.from_pretrained(
                    info["model"],
                    revision=info.get("revision"),
                    trust_remote_code=True,
                    torch_dtype=torch.float32,
                ).to("cpu")
                model_cache[model_key] = {
                    "type": "moondream",
                    "model": model,
                }
            else:
                model_cache[model_key] = {
                    "type": "pipeline",
                    "model": pipeline(
                        "image-to-text",
                        model=info["model"],
                        device=-1,
                    ),
                }

            app.logger.info(f"{info['name']} loaded successfully!")

        return model_cache[model_key]

    def get_llm(model_key="smollm2-1.7b"):
        """Load and cache text-generation model"""
        if model_key not in llm_cache:
            if model_key not in LLM_MODELS:
                model_key = "smollm2-1.7b"

            info = LLM_MODELS[model_key]
            app.logger.info(f"Loading LLM {info['name']}...")
            pipe = pipeline(
                "text-generation",
                model=info["model"],
                torch_dtype=torch.float32,
                device=-1,
            )

            # Ensure pad token exists to avoid warning/errors
            tokenizer = getattr(pipe, "tokenizer", None)
            pad_token_id = info.get("pad_token_id")
            if tokenizer:
                if pad_token_id is None:
                    pad_token_id = tokenizer.pad_token_id or tokenizer.eos_token_id
                if tokenizer.pad_token_id is None and pad_token_id is not None:
                    tokenizer.pad_token_id = pad_token_id
            llm_cache[model_key] = {
                "pipe": pipe,
                "pad_token_id": pad_token_id,
            }
            app.logger.info(f"LLM {info['name']} loaded successfully!")

        return llm_cache[model_key]
    
    # Pre-load default model
    app.logger.info("Loading default image captioning model...")
    try:
        get_model("florence-2")
        app.logger.info("Default model loaded successfully!")
    except Exception as e:
        app.logger.error(f"Failed to load default model: {traceback.format_exc()}")
    
    @app.route('/models', methods=['GET'])
    def list_models():
        """Return available models"""
        return jsonify(
            {
                'models': [
                    {
                        'key': key,
                        'name': info['name'],
                        'description': info['description'],
                        'modes': list(info.get("modes", {}).keys()) if info.get("modes") else None,
                        'default_mode': info.get("default_mode"),
                    }
                    for key, info in MODELS.items()
                ],
                'llms': [
                    {
                        'key': key,
                        'name': info['name'],
                        'description': info['description'],
                    }
                    for key, info in LLM_MODELS.items()
                ]
            }
        )

    @app.route('/caption', methods=['POST'])
    def caption_image():
        """Generate caption for an image"""
        try:
            if 'image' not in request.files:
                app.logger.warning('Request received without image file')
                return jsonify({'error': 'No image provided'}), 400
            
            file = request.files['image']
            if file.filename == '':
                app.logger.warning('Empty filename in request')
                return jsonify({'error': 'No image selected'}), 400
            
            # Get selected model (default to florence-2)
            model_key = request.form.get('model', 'florence-2')
            question = request.form.get('question', '')
            mode = request.form.get('mode')
            
            # Open and process the image
            image = Image.open(file.stream).convert('RGB')
            
            # Get the appropriate model
            loaded = get_model(model_key)

            if loaded["type"] == "florence":
                processor = loaded["processor"]
                model = loaded["model"]
                
                prompt = florence_prompt_for_mode(mode)
                question_prefix = f"Question: {question}\nAnswer: " if question else ""
                    
                inputs = processor(text=prompt, images=image, return_tensors="pt").to(model.device)
                with torch.no_grad():
                    generated_ids = model.generate(
                        input_ids=inputs["input_ids"],
                        pixel_values=inputs["pixel_values"],
                        max_new_tokens=256,
                        num_beams=3
                    )
                caption = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                
                # Remove the task prefix from output
                if caption.startswith(prompt):
                    caption = caption[len(prompt):].strip()
                
                caption = question_prefix + caption
            elif loaded["type"] == "moondream":
                model = loaded["model"]
                prompt = question.strip() if question else None
                mode_to_use = mode or MODELS.get(model_key, {}).get("default_mode", "caption")

                if mode_to_use == "roast":
                    prompt = prompt or "Roast this image in one short, witty sentence."
                    result = model.query(image, prompt)
                    caption = result.get("answer") if isinstance(result, dict) else str(result)
                else:
                    # Default to caption mode
                    result = model.caption(image)
                    caption = result.get("caption") if isinstance(result, dict) else str(result)
            else:
                captioner = loaded["model"]
                result = captioner(image)
                caption = result[0]['generated_text']
            
            app.logger.info(f'Image analyzed successfully with model: {model_key}')
            return jsonify({'text': caption})
        
        except Exception as e:
            app.logger.error(f"Error analyzing image: {traceback.format_exc()}")
            return jsonify({'error': f'Error analyzing image: {str(e)}'}), 500

    @app.route('/generate', methods=['POST'])
    def generate_text():
        """Generate text using LLM"""
        try:
            data = request.get_json(silent=True) or {}
            prompt = data.get('prompt', '')
            model_key = data.get('model', 'smollm2-1.7b')
            max_new_tokens = int(data.get('max_new_tokens', 256))
            temperature = float(data.get('temperature', 0.7))

            loaded = get_llm(model_key)
            pipe = loaded["pipe"]
            pad_token_id = loaded.get("pad_token_id")

            outputs = pipe(
                prompt,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                pad_token_id=pad_token_id,
                num_return_sequences=1,
            )

            # Extract generated text
            generated = outputs[0]['generated_text']
            text = generated[len(prompt):] if generated.startswith(prompt) else generated

            app.logger.info(f'Text generated successfully with model: {model_key}')
            return jsonify({
                'text': text,
                'model': model_key,
            })
        except Exception as e:
            app.logger.error(f"Error generating text: {traceback.format_exc()}")
            return jsonify({'error': f'Error generating text: {str(e)}'}), 500
    
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok'}), 200
    
    return app

if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    app = create_app()
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host=host, port=port, debug=debug, use_reloader=False)
