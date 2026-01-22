#!/bin/bash
# Quick deployment helper script
# Run this to validate your setup before pushing to production

echo "🚀 ML API - Production Setup Validation"
echo "========================================"
echo ""

# Check Python
if command -v python3 &> /dev/null; then
    echo "✅ Python3 found: $(python3 --version)"
else
    echo "❌ Python3 not found. Please install Python 3.10+"
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker found: $(docker --version)"
else
    echo "⚠️  Docker not found. Required for deployment."
    echo "   Download: https://www.docker.com/products/docker-desktop"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose found: $(docker-compose --version)"
else
    echo "⚠️  Docker Compose not found. Required for local testing."
fi

echo ""
echo "📋 File Checklist:"
echo "=================="

files=("server.py" "wsgi.py" "requirements.txt" "Dockerfile" "docker-compose.yml" ".env.example" ".gitignore" ".dockerignore" "README.md" "DEPLOYMENT.md")

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (MISSING!)"
    fi
done

echo ""
echo "🔧 Quick Commands:"
echo "=================="
echo "1. Local testing with Docker:"
echo "   docker-compose up --build"
echo ""
echo "2. Deploy to DigitalOcean:"
echo "   - Read DEPLOYMENT.md"
echo "   - Choose: App Platform, Droplet, or Container Registry"
echo ""
echo "3. Push to GitHub:"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Production setup'"
echo "   git remote add origin <YOUR_REPO>"
echo "   git push -u origin main"
echo ""

echo "📚 Documentation:"
echo "================"
echo "- README.md - Quick reference & API docs"
echo "- DEPLOYMENT.md - Complete deployment guide"
echo "- PRODUCTION_SETUP.md - Summary of all changes"
echo ".env.example - Configuration template"
echo ""

echo "✨ Setup complete! Ready for production deployment."
echo ""
echo "Next: Read DEPLOYMENT.md and choose your deployment method."
