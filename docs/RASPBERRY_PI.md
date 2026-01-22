# Zero Email - Raspberry Pi Deployment Guide

Run Zero Email entirely on your Raspberry Pi for a fully self-hosted, private email experience. No cloud services required (except for Gmail API access).

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Raspberry Pi 5                      │
│                                                      │
│  ┌──────────┐    ┌───────────────┐    ┌──────────┐ │
│  │  Nginx   │───▶│   Miniflare   │───▶│ Postgres │ │
│  │ :3000    │    │   (Backend)   │    │  :5432   │ │
│  │          │    │    :8787      │    └──────────┘ │
│  │ Frontend │    │               │                  │
│  │ (static) │    │ Durable Objs  │    ┌──────────┐ │
│  └──────────┘    │ KV, Queues    │───▶│  Valkey  │ │
│                  │ R2 (files)    │    │  :6379   │ │
│                  └───────────────┘    └──────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
         │
         ▼
    Home Network Only
    (192.168.x.x:3000)
```

### Components

| Component | Purpose | Port |
|-----------|---------|------|
| Nginx | Static frontend + API proxy | 3000 |
| Miniflare | Backend (Cloudflare Workers simulator) | 8787 (internal) |
| PostgreSQL 17 | Email database | 5432 (internal) |
| Valkey | Redis-compatible cache | 6379 (internal) |
| Upstash Proxy | Redis HTTP API compatibility | 80 (internal) |

## Requirements

### Hardware
- **Raspberry Pi 5** (4GB+ RAM recommended)
- 32GB+ microSD card or SSD (SSD strongly recommended)
- Stable power supply (official Pi 5 PSU recommended)

### Software (on Pi)
- Raspberry Pi OS (64-bit) - Bookworm or later
- Docker and Docker Compose

### Software (on your Mac/PC)
- Node.js 20+
- pnpm
- SSH access to Pi

## Quick Start

### Step 1: Prepare Your Raspberry Pi

```bash
# On your Raspberry Pi
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
# SSH back in

# Verify Docker works
docker run hello-world
```

### Step 2: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://raspberrypi.local:3000/api/auth/callback/google`
   - (Also add your Pi's IP: `http://192.168.x.x:3000/api/auth/callback/google`)
5. Save your Client ID and Client Secret

### Step 3: Build on Your Mac/PC

```bash
# Clone the repository (if not already done)
git clone https://github.com/nichniq/zero.git
cd zero

# Make scripts executable
chmod +x scripts/pi/*.sh

# Build the frontend
./scripts/pi/build.sh
```

### Step 4: Deploy to Raspberry Pi

```bash
# Deploy (replace with your Pi's hostname or IP)
PI_HOST=raspberrypi.local ./scripts/pi/deploy.sh

# The script will prompt you to configure .env.pi on the Pi
# At minimum, set:
#   - GOOGLE_CLIENT_ID
#   - GOOGLE_CLIENT_SECRET
#   - BETTER_AUTH_SECRET (generate with: openssl rand -hex 32)
```

### Step 5: Access Zero Email

Open your browser and go to:
- `http://raspberrypi.local:3000`
- Or `http://192.168.x.x:3000` (your Pi's IP address)

## Configuration

### Environment Variables

Edit `.env.pi` on your Raspberry Pi:

```bash
ssh pi@raspberrypi.local
cd ~/zero
nano .env.pi
```

#### Required Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `BETTER_AUTH_SECRET` | Random 32-char hex string for auth |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Public URL of the app | `http://raspberrypi.local:3000` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `RESEND_API_KEY` | Resend API key for sending emails | - |
| `POSTGRES_PASSWORD` | Database password | `postgres` |

### Custom Hostname

If you want to use a different hostname:

1. Edit `/etc/hostname` on your Pi
2. Update `APP_URL` and `COOKIE_DOMAIN` in `.env.pi`
3. Update Google OAuth redirect URIs
4. Restart the services

## Management Commands

Run these commands on your Raspberry Pi:

```bash
cd ~/zero

# View logs
docker compose -f docker-compose.pi.yaml logs -f

# View specific service logs
docker compose -f docker-compose.pi.yaml logs -f miniflare
docker compose -f docker-compose.pi.yaml logs -f nginx

# Restart all services
docker compose -f docker-compose.pi.yaml restart

# Stop all services
docker compose -f docker-compose.pi.yaml down

# Start all services
docker compose -f docker-compose.pi.yaml up -d

# Check service status
docker compose -f docker-compose.pi.yaml ps

# View resource usage
docker stats
```

## Auto-Start on Boot

Enable Zero Email to start automatically when your Pi boots:

```bash
# On your Raspberry Pi
sudo cp ~/zero/scripts/pi/zero.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zero.service
sudo systemctl start zero.service

# Check status
sudo systemctl status zero.service

# View logs
sudo journalctl -u zero.service -f
```

## Updating

To update Zero Email:

```bash
# On your Mac/PC
cd zero
git pull
./scripts/pi/build.sh
PI_HOST=raspberrypi.local ./scripts/pi/deploy.sh
```

## Troubleshooting

### Cannot connect to Pi

```bash
# Check if Pi is reachable
ping raspberrypi.local

# If hostname doesn't work, use IP address
# Find Pi's IP from your router or run on Pi:
hostname -I
```

### Docker services won't start

```bash
# Check Docker is running
sudo systemctl status docker

# Check for errors in logs
docker compose -f docker-compose.pi.yaml logs

# Rebuild containers
docker compose -f docker-compose.pi.yaml build --no-cache
docker compose -f docker-compose.pi.yaml up -d
```

### Database connection errors

```bash
# Check if PostgreSQL is running
docker compose -f docker-compose.pi.yaml ps db

# View database logs
docker compose -f docker-compose.pi.yaml logs db

# Reset database (WARNING: loses all data)
docker compose -f docker-compose.pi.yaml down -v
docker compose -f docker-compose.pi.yaml up -d
```

### Out of memory errors

The Pi deployment is optimized for 4GB RAM. If you have 2GB:

1. Edit `docker-compose.pi.yaml`
2. Reduce memory limits for each service
3. Consider disabling some services

### Google OAuth errors

1. Verify redirect URIs match exactly in Google Console
2. Check `COOKIE_DOMAIN` matches your hostname
3. Ensure `APP_URL` is correct

## Performance Tips

### Use an SSD

MicroSD cards are slow. For better performance:
1. Get a USB 3.0 SSD
2. Boot from SSD using `rpi-imager`
3. Or mount SSD for Docker volumes

### Optimize PostgreSQL

The default config is already optimized for Pi. For more tuning, edit the `command` section in `docker-compose.pi.yaml`.

### Monitor Resources

```bash
# Live resource monitoring
htop

# Docker-specific stats
docker stats

# Disk usage
df -h
docker system df
```

## Security Considerations

### Network Security

This deployment is designed for home network use only. Do NOT expose it to the internet without:
- Setting up HTTPS with proper certificates
- Using a reverse proxy with security headers
- Implementing rate limiting
- Regular security updates

### Data Security

- All email data is stored locally on your Pi
- Database is only accessible within Docker network
- No data leaves your network (except Gmail API calls)

### Backup

```bash
# Backup database
docker compose -f docker-compose.pi.yaml exec db pg_dump -U postgres zerodotemail > backup.sql

# Backup all data (including Miniflare state)
sudo tar -czf zero-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/zero-postgres-data \
  /var/lib/docker/volumes/zero-valkey-data \
  /var/lib/docker/volumes/zero-miniflare-data
```

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.pi.yaml` | Docker Compose orchestration |
| `docker/pi/Dockerfile.miniflare` | Backend container definition |
| `wrangler.pi.toml` | Miniflare configuration |
| `nginx.pi.conf` | Nginx reverse proxy config |
| `.env.pi.example` | Environment template |
| `scripts/pi/build.sh` | Build script (run on Mac/PC) |
| `scripts/pi/deploy.sh` | Deployment script |
| `scripts/pi/zero.service` | Systemd service file |

## Support

- GitHub Issues: [github.com/nichniq/zero/issues](https://github.com/nichniq/zero/issues)
- Documentation: [github.com/nichniq/zero](https://github.com/nichniq/zero)
