# Deployment Guide - DigitalOcean

## Prerequisites
- DigitalOcean account
- Docker installed locally for testing
- SSH key for server access
- Domain name (optional but recommended)

## Option 1: Deploy Using DigitalOcean App Platform (Recommended for Beginners)

### Step 1: Prepare Your Repository
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Connect to DigitalOcean App Platform
1. Go to [DigitalOcean Dashboard](https://cloud.digitalocean.com)
2. Click **Apps** → **Create App**
3. Select **GitHub** as source
4. Authorize GitHub and select your repository
5. DigitalOcean will auto-detect the Dockerfile
6. Configure:
   - **HTTP Port**: 5000
   - **Resource Tier**: Basic ($12/month minimum for ML models)
7. Add environment variables (see `.env.example`)
8. Click **Create Resources**

### Step 3: Configure Environment
In the App Platform dashboard:
- Go to **Settings** → **Environment**
- Add all variables from `.env.example`
- Set `FLASK_ENV=production`

---

## Option 2: Deploy Using Droplet + Docker (More Control)

### Step 1: Create a Droplet
1. **DigitalOcean Dashboard** → **Create** → **Droplets**
2. Choose:
   - Image: **Ubuntu 22.04 LTS**
   - Size: **4GB RAM / 2 vCPU** (minimum for ML models)
   - Region: Closest to your users
   - Add SSH key for passwordless login

### Step 2: SSH into Your Droplet
```bash
ssh root@YOUR_DROPLET_IP
```

### Step 3: Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### Step 4: Clone and Setup Repository
```bash
cd /root
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Create .env file
cp .env.example .env
nano .env  # Edit with your configuration
```

### Step 5: Start the Container
```bash
docker-compose up -d

# Check logs
docker-compose logs -f api

# Stop container
docker-compose down
```

### Step 6: Setup Reverse Proxy (Nginx) - Optional but Recommended
```bash
apt-get update && apt-get install -y nginx

# Create nginx config
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Increase file upload size
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF

# Test and restart nginx
nginx -t
systemctl restart nginx
```

### Step 7: Setup SSL (Let's Encrypt) - Highly Recommended
```bash
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -d your-domain.com

# Auto-renewal is automatic with certbot
```

---

## Option 3: Deploy Using DigitalOcean Container Registry

### Step 1: Create Container Registry
1. **DigitalOcean Dashboard** → **Container Registry**
2. Create a new registry

### Step 2: Build and Push Image
```bash
# On your local machine
docker login registry.digitalocean.com

docker build -t registry.digitalocean.com/YOUR_REGISTRY/ml-api:latest .

docker push registry.digitalocean.com/YOUR_REGISTRY/ml-api:latest
```

### Step 3: Deploy on Droplet
Update `docker-compose.yml`:
```yaml
services:
  api:
    image: registry.digitalocean.com/YOUR_REGISTRY/ml-api:latest
    # ... rest of config
```

---

## Monitoring & Maintenance

### View Logs
```bash
docker-compose logs -f --tail 50

# Or for specific service
docker-compose logs -f api
```

### Monitor Resource Usage
```bash
docker stats
```

### Update Models Cache
Models are downloaded on first run and cached. Budget time for this (5-10 minutes depending on model).

### Restart Service
```bash
docker-compose restart api
```

### Regular Updates
```bash
git pull
docker-compose down
docker-compose up -d --build
```

---

## Firewall Configuration (If Using Droplet)

```bash
# Allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Performance Tips

1. **Models**: First load takes 5-10 minutes. Cache persists across restarts.
2. **Memory**: Ensure droplet has 4GB+ RAM for ML models.
3. **Timeout**: Gunicorn timeout is set to 120s for heavy operations.
4. **Upload Limit**: Set to 50MB in the API and nginx config.
5. **Workers**: Using 1 worker with 4 threads for memory efficiency.

---

## Troubleshooting

### Port Already in Use
```bash
# Change port in docker-compose.yml or .env
FLASK_PORT=8000
```

### Out of Memory
- Upgrade droplet size
- Use lighter models (blip-base instead of blip-large)
- Consider using API request queuing

### Slow First Request
- This is normal as models load. Add timeout to your client.

### SSL Certificate Issues
```bash
certbot renew --dry-run
certbot renew
```

---

## Cost Estimation

- **Droplet (4GB)**: $24/month
- **Bandwidth**: Included (40TB/month)
- **Backups**: $4.80/month (optional)
- **Total**: ~$25-30/month

---

## Security Checklist

- [ ] Set strong password/SSH keys
- [ ] Enable SSL/HTTPS
- [ ] Set up firewall rules
- [ ] Regular security updates: `apt-get update && apt-get upgrade`
- [ ] Monitor API logs for suspicious activity
- [ ] Consider adding rate limiting or API keys
- [ ] Backup important data regularly

---

## Next Steps

1. Test locally with `docker-compose up`
2. Push to GitHub
3. Deploy using your preferred method
4. Monitor first few requests for issues
5. Set up monitoring/alerting

For questions, check DigitalOcean documentation or create an issue in your repository.
