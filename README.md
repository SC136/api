# ML API - Image Captioning & Text Generation

A production-ready Flask API for image captioning using state-of-the-art ML models and lightweight LLM support.

## Features

- **Multiple Image Captioning Models**:
  - BLIP (Base & Large)
  - ViT-GPT2
  - Florence-2
  - Moondream2

- **Text Generation**:
  - SmolLM2 1.7B
  - Phi-3 Mini
  - Gemma-2 2B
  - Qwen2.5 1.5B
  - TinyLlama 1.1B

- **Production Ready**:
  - Docker containerization
  - Gunicorn WSGI server
  - Comprehensive logging
  - Error handling
  - Environment configuration

## Quick Start

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

### Docker
```bash
# Build and run with docker-compose
docker-compose up --build

# API will be available at http://localhost:5000
```

## API Endpoints

### 1. List Available Models
```bash
GET /models
```
Returns all available vision and LLM models.

### 2. Image Analysis
```bash
POST /analyze
Content-Type: multipart/form-data

Parameters:
- image: Image file (required)
- model: Model key (default: florence-2)
- mode: For Florence/Moondream specific modes (optional)
- question: Custom question for the image (optional)
```

**Example:**
```bash
curl -X POST http://localhost:5000/analyze \
  -F "image=@photo.jpg" \
  -F "model=florence-2" \
  -F "mode=more_detailed"
```

### 3. Text Generation
```bash
POST /generate
Content-Type: application/json

{
  "prompt": "Your prompt here",
  "model": "smollm2-1.7b",
  "max_new_tokens": 256,
  "temperature": 0.7
}
```

### 4. Health Check
```bash
GET /health
```

## Configuration

Create a `.env` file based on `.env.example`:
```env
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=False
FLASK_ENV=production
MAX_CONTENT_LENGTH=52428800
```

## Deployment

For detailed deployment instructions to DigitalOcean, AWS, or other platforms, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Quick Deployment Summary:**
1. **DigitalOcean App Platform** - Easiest, automatic deployment from GitHub
2. **Droplet + Docker** - More control, ~$24/month
3. **Container Registry** - Best for CI/CD pipelines

## Logs

Logs are stored in `logs/api.log` with rotation (max 10MB per file).

## Monitoring

### Check Service Status
```bash
docker-compose ps

# View logs
docker-compose logs -f
```

### Resource Usage
```bash
docker stats
```

## Performance Tips

1. **First Load**: Models cache on first use (5-10 minutes)
2. **Memory**: Requires 4GB+ RAM for optimal performance
3. **Workers**: Configured with 1 worker × 4 threads for memory efficiency
4. **Timeout**: 120 seconds for heavy ML operations

## Hardware Requirements

- **Minimum**: 4GB RAM, 2 vCPU
- **Recommended**: 8GB RAM, 4 vCPU
- **Storage**: 10GB+ for model cache

## Troubleshooting

**Out of Memory**: Use lighter models or upgrade hardware
**Slow First Request**: Normal - models are loading. Set timeout to 120+ seconds
**Port Already in Use**: Change `FLASK_PORT` in `.env`

## Development

### Install Development Dependencies
```bash
pip install -r requirements.txt
export FLASK_DEBUG=True
python server.py
```

### Code Structure
- `server.py` - Main Flask application
- `wsgi.py` - WSGI entry point for production
- `Dockerfile` - Container configuration
- `docker-compose.yml` - Local development setup
- `requirements.txt` - Python dependencies

## License

MIT

## Support

For issues and questions, check [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting guides.
