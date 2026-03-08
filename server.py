from flask import Flask, request, jsonify
from transformers import pipeline, AutoProcessor, AutoModelForCausalLM
from PIL import Image
import traceback
import os
import torch

# Disable symlink warnings
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

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
    },
    "plant-vit": {
        "name": "Plant/Crop Disease ViT",
        "model": "wambugu71/crop_leaf_diseases_vit",
        "description": "Detects crop species + diseases (PlantVillage 38 classes, ~300MB)",
        "type": "classification"
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
    
    # Cache for loaded models
    model_cache = {}
    llm_cache = {}
    
    def get_model(model_key="blip-base"):
        """Load and cache model"""
        if model_key not in model_cache:
            if model_key not in MODELS:
                model_key = "blip-base"

            info = MODELS[model_key]
            print(f"Loading {info['name']}...")

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
            elif info.get("type") == "classification":
                model_cache[model_key] = {
                    "type": "classification",
                    "model": pipeline(
                        "image-classification",
                        model=info["model"],
                        device=-1,
                    ),
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

            print(f"{info['name']} loaded successfully!")

        return model_cache[model_key]

    def get_llm(model_key="smollm2-1.7b"):
        """Load and cache text-generation model"""
        if model_key not in llm_cache:
            if model_key not in LLM_MODELS:
                model_key = "smollm2-1.7b"

            info = LLM_MODELS[model_key]
            print(f"Loading LLM {info['name']}...")
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
            print(f"LLM {info['name']} loaded successfully!")

        return llm_cache[model_key]
    
    # Pre-load default model
    print("Loading default image captioning model...")
    get_model("florence-2")
    print("Model loaded successfully!")
    
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
    
    @app.route('/analyze', methods=['POST'])
    def analyze_image():
        try:
            if 'image' not in request.files:
                return jsonify({'error': 'No image provided'}), 400
            
            file = request.files['image']
            if file.filename == '':
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
            elif loaded["type"] == "classification":
                # Classification models (like plant-vit) - format top predictions as text
                results = loaded["model"](image, top_k=5)
                lines = ["Detected:"]
                for pred in results:
                    label = pred['label'].replace("___", " - ").replace("_", " ")
                    confidence = pred['score'] * 100
                    lines.append(f"• {label}: {confidence:.1f}%")
                caption = "\n".join(lines)
            else:
                captioner = loaded["model"]
                result = captioner(image)
                caption = result[0]['generated_text']
            
            return jsonify({'text': caption})
        
        except Exception as e:
            print(f"Error: {traceback.format_exc()}")
            return jsonify({'error': f'Error analyzing image: {str(e)}'}), 500

    @app.route('/generate', methods=['POST'])
    def generate_text():
        try:
            data = request.get_json(silent=True) or {}
            prompt = data.get('prompt', '')
            model_key = data.get('model', 'smollm2-1.7b')
            temperature = float(data.get('temperature', 0.7))
            top_p = float(data.get('top_p', 0.9))
            top_k = int(data.get('top_k', 50))
            repetition_penalty = float(data.get('repetition_penalty', 1.3))

            # Scale max_new_tokens based on prompt length if not explicitly set
            default_max = max(32, min(256, len(prompt.split()) * 8))
            max_new_tokens = int(data.get('max_new_tokens', default_max))

            loaded = get_llm(model_key)
            pipe = loaded["pipe"]
            pad_token_id = loaded.get("pad_token_id")

            tokenizer = pipe.tokenizer
        
            if hasattr(tokenizer, "apply_chat_template") and getattr(tokenizer, "chat_template", None):
                messages = [
                    {"role": "system", "content": "You are a helpful, friendly AI assistant. Respond concisely and directly to what the user says. For greetings, greet back briefly."},
                    {"role": "user", "content": prompt}
                ]
                
                # Note: some models don't support system prompts, so we can try to apply it,
                # and if it fails, fallback to just the user message
                try:
                    formatted_prompt = tokenizer.apply_chat_template(
                        messages, 
                        tokenize=False, 
                        add_generation_prompt=True
                    )
                except Exception:
                    # If it failed because of the system role, let's try manual fallback for known models or just user
                    if "tinyllama" in model_key.lower():
                        formatted_prompt = f"<|system|>\nYou are a helpful, friendly AI assistant. Respond concisely and directly to what the user says. For greetings, greet back briefly.</s>\n<|user|>\n{prompt}</s>\n<|assistant|>\n"
                    else:
                        messages = [{"role": "user", "content": prompt}]
                        formatted_prompt = tokenizer.apply_chat_template(
                            messages, 
                            tokenize=False, 
                            add_generation_prompt=True
                        )
                kwargs = {"return_full_text": False}
            else:
                formatted_prompt = prompt
                kwargs = {}

            outputs = pipe(
                formatted_prompt,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                repetition_penalty=repetition_penalty,
                pad_token_id=pad_token_id,
                num_return_sequences=1,
                **kwargs,
            )

            text = outputs[0].get("generated_text") if outputs else ""
            
            # If return_full_text=False is not honored (common in some pipeline versions + tokenizer chat templates), 
            # manually slice the prompt off
            if text.startswith(formatted_prompt):
                text = text[len(formatted_prompt):]

            # Trim trailing incomplete sentence if text was cut off by max_new_tokens
            text = text.strip()
            if text and text[-1] not in '.!?"\')':
                # Find the last sentence-ending punctuation
                for i in range(len(text) - 1, -1, -1):
                    if text[i] in '.!?':
                        text = text[:i + 1]
                        break
                
            return jsonify({
                'text': text,
                'model': model_key,
            })
        except Exception as e:
            print(f"LLM Error: {traceback.format_exc()}")
            return jsonify({'error': f'Error generating text: {str(e)}'}), 500
    
    @app.route('/plant', methods=['POST'])
    def plant_detect():
        try:
            if 'image' not in request.files:
                return jsonify({'error': 'No image provided'}), 400
            
            file = request.files['image']
            if file.filename == '':
                return jsonify({'error': 'No image selected'}), 400
            
            model_key = request.form.get('model', 'plant-vit')
            loaded = get_model(model_key)
            
            if loaded["type"] != "classification":
                return jsonify({'error': 'Model not for classification'}), 400
            
            image = Image.open(file.stream).convert('RGB')
            results = loaded["model"](image, top_k=5)  # Top 5 predictions
            
            return jsonify({
                'predictions': [
                    {
                        'plant_disease': pred['label'],
                        'confidence': float(pred['score']),
                    }
                    for pred in results
                ],
                'model': model_key
            })
        
        except Exception as e:
            print(f"Plant detect error: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok'}), 200
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='localhost', port=5000, debug=False, use_reloader=False)
