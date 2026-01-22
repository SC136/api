# Simple Deployment (No Docker Required)

Deploy your API directly on a DigitalOcean Droplet using Python.

## Step 1: Create a Droplet

1. Go to [DigitalOcean](https://cloud.digitalocean.com)
2. Click **Create** → **Droplets**
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: 4GB RAM / 2 vCPU ($24/month) - Required for ML models
   - **Region**: Closest to your users
   - **Authentication**: Password (simpler) or SSH Key
4. Click **Create Droplet**
5. Note the **IP address** shown

---

## Step 2: Connect to Your Server

Using PowerShell or Terminal:
```bash
ssh root@YOUR_IP_ADDRESS
```
Enter the password you set (or use SSH key).

---

## Step 3: Install Python & Dependencies

Run these commands on your Droplet:

```bash
# Update system
apt update && apt upgrade -y

# Install Python 3.10 and pip
apt install -y python3.10 python3-pip python3.10-venv git

# Create app directory
mkdir -p /app
cd /app
```

---

## Step 4: Upload Your Code

**Option A: Using Git (Recommended)**
```bash
cd /app
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

**Option B: Using SCP (Upload files directly)**
From your local PowerShell:
```powershell
scp -r c:\code\api\* root@YOUR_IP:/app/
```

---

## Step 5: Setup Python Environment

```bash
cd /app

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

This will take 5-10 minutes (downloading PyTorch + ML libraries).

---

## Step 6: Create a Service File

Create a systemd service so your API runs automatically:

```bash
cat > /etc/systemd/system/ml-api.service << 'EOF'
[Unit]
Description=ML Image Captioning API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/app
Environment="PATH=/app/venv/bin"
ExecStart=/app/venv/bin/gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 4 --timeout 300 wsgi:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

---

## Step 7: Start the API

```bash
# Reload systemd
systemctl daemon-reload

# Enable service (auto-start on reboot)
systemctl enable ml-api

# Start the service
systemctl start ml-api

# Check status
systemctl status ml-api
```

---

## Step 8: Open Firewall

```bash
ufw allow 22    # SSH
ufw allow 5000  # API port
ufw enable
```

---

## Step 9: Test Your API

From your local machine:
```bash
curl http://YOUR_IP:5000/health
curl http://YOUR_IP:5000/models
```

You should see `{"status": "ok"}` for the health check.

---

## Useful Commands

```bash
# View logs
journalctl -u ml-api -f

# Restart API
systemctl restart ml-api

# Stop API
systemctl stop ml-api

# Update code from Git
cd /app && git pull && systemctl restart ml-api
```

---

## Optional: Add SSL (HTTPS)

For production apps, add HTTPS:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Setup Nginx proxy
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }
}
EOF

systemctl restart nginx
ufw allow 80
ufw allow 443

# If you have a domain, add SSL:
certbot --nginx -d yourdomain.com
```

---

## Cost Summary

| Resource | Cost |
|----------|------|
| Droplet (4GB) | $24/month |
| Bandwidth | Included |
| **Total** | **~$24/month** |

---

## Troubleshooting

**API not starting?**
```bash
journalctl -u ml-api -n 50  # Check last 50 log lines
```

**Out of memory?**
- Use the lighter `blip-base` model instead of `florence-2`
- Or upgrade to 8GB Droplet ($48/month)

**First request is slow?**
- Normal! Models download on first use (1-5 minutes)
- Subsequent requests are fast
