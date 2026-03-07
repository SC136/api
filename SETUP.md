# Antigravity - Local Image Analysis

## Quick Start

### Option 1: Automatic Start (Windows)
```bash
./start.bat
```

### Option 2: Manual Start

**Terminal 1 - Python Server:**
```bash
pip install -r requirements.txt
python server.py
```

**Terminal 2 - Next.js App:**
```bash
npm run dev
```

Then open http://localhost:3000

## How It Works

1. **Python Server** (port 5000): Runs the BLIP image captioning model locally
2. **Next.js App** (port 3000): Web interface that sends images to the Python server
3. **No API Keys**: Everything runs locally - no rate limits!

## First Run

The first time you run `server.py`, it will download the BLIP model (~900MB). This happens automatically and is cached for future runs.

## Troubleshooting

- **"Connection refused" error**: Make sure the Python server is running on port 5000
- **"Model loading..." takes too long**: First run downloads the model. Subsequent runs are instant.
- **Out of memory**: If running on low RAM, you can use a smaller model by editing `server.py` to use `"Salesforce/blip-image-captioning-large"` instead
