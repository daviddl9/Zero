# Tailscale HTTPS Setup for Zero Email

This guide explains how to set up HTTPS for Zero Email on your local network using Tailscale. This is required for Google OAuth with sensitive scopes (like Gmail access) which mandate HTTPS.

## Why Tailscale?

Google OAuth requires HTTPS for sensitive scopes. Tailscale provides:

- **Automatic HTTPS certificates** for `*.ts.net` domains
- **Works across devices** on your Tailnet
- **Traffic stays local** when devices are on the same LAN
- **No port forwarding** or firewall changes needed
- **Free for personal use**

## Quick Start

### Option 1: Automated Setup

Run the setup script on your Pi/server:

```bash
./scripts/setup-tailscale-https.sh
```

This will:
1. Install Tailscale (if needed)
2. Get your Tailscale hostname
3. Generate HTTPS certificates
4. Create a `.env` file with correct URLs

### Option 2: Manual Setup

#### Step 1: Install Tailscale

On your Pi or server:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start and authenticate
sudo tailscale up

# Get your hostname
tailscale status
```

Note your hostname (e.g., `pi.tail-abc123.ts.net`).

#### Step 2: Enable HTTPS Certificates

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/dns)
2. Enable **MagicDNS** if not already enabled
3. Enable **HTTPS Certificates**

#### Step 3: Generate Certificates

```bash
# Generate certificate for your hostname
sudo tailscale cert <your-hostname>.ts.net

# Create certs directory in project
mkdir -p /path/to/zero/certs

# Copy certificates
sudo cp /var/lib/tailscale/certs/<your-hostname>.ts.net.crt /path/to/zero/certs/server.crt
sudo cp /var/lib/tailscale/certs/<your-hostname>.ts.net.key /path/to/zero/certs/server.key

# Set permissions
sudo chown $USER:$USER /path/to/zero/certs/server.*
chmod 644 /path/to/zero/certs/server.crt
chmod 600 /path/to/zero/certs/server.key
```

#### Step 4: Configure Environment

Copy the example and edit:

```bash
cp .env.tailscale.example .env
```

Update `.env` with your values:

```bash
# Replace <your-hostname> with your actual Tailscale hostname
TAILSCALE_HOSTNAME=pi.tail-abc123.ts.net

APP_URL=https://pi.tail-abc123.ts.net
BACKEND_URL=https://pi.tail-abc123.ts.net/api
BETTER_AUTH_URL=https://pi.tail-abc123.ts.net
BETTER_AUTH_TRUSTED_ORIGINS=https://pi.tail-abc123.ts.net
COOKIE_DOMAIN=pi.tail-abc123.ts.net
GOOGLE_REDIRECT_URI=https://pi.tail-abc123.ts.net/api/auth/callback/google

# Add your Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Generate secure secrets
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
```

#### Step 5: Update Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 credentials
3. Add **Authorized JavaScript origins**:
   - `https://<your-hostname>.ts.net`
4. Add **Authorized redirect URIs**:
   - `https://<your-hostname>.ts.net/api/auth/callback/google`
5. Save

#### Step 6: Deploy

```bash
# Build frontend
cd apps/mail && bun run build && cd ../..

# Standalone deployment
docker compose -f docker-compose.standalone.yaml -f docker-compose.tailscale.yaml up -d

# OR Pi deployment (with shared MinIO)
docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml -f docker-compose.tailscale.yaml up -d
```

#### Step 7: Access

1. Install Tailscale on your laptop/phone
2. Join the same Tailnet
3. Open: `https://<your-hostname>.ts.net`
4. Sign in with Google

## Troubleshooting

### Certificate Errors

If you see certificate errors:

1. Ensure HTTPS is enabled in Tailscale admin console
2. Regenerate certificates: `sudo tailscale cert <hostname>`
3. Verify certificates are in `certs/` directory
4. Check nginx can read them: `ls -la certs/`

### OAuth Errors

If Google OAuth fails:

1. Verify redirect URI matches exactly (no trailing slash)
2. Check HTTPS is working (no mixed content)
3. Ensure `COOKIE_DOMAIN` is set correctly
4. Check browser console for specific errors

### Connection Refused

If you can't connect:

1. Verify Tailscale is running: `tailscale status`
2. Check both devices are on same Tailnet
3. Verify ports 80 and 443 are exposed in docker-compose
4. Check nginx logs: `docker logs zero-nginx`

### Certificate Renewal

Tailscale certificates are valid for 90 days and auto-renew. To manually renew:

```bash
sudo tailscale cert <your-hostname>.ts.net
# Copy new certificates to certs/ directory
docker compose restart nginx
```

## Alternative: SSH Tunnel

If you prefer not to use Tailscale, you can use an SSH tunnel. Google allows `http://localhost` for OAuth:

```bash
# From your laptop
ssh -L 3001:localhost:3001 pi@192.168.7.14

# Access at http://localhost:3001
# Google redirect URI: http://localhost:3001/api/auth/callback/google
```

This works but only from one machine at a time.

## File Structure

```
zero/
├── certs/
│   ├── server.crt          # Tailscale certificate
│   └── server.key          # Tailscale private key
├── docker-compose.standalone.yaml
├── docker-compose.pi.yaml
├── docker-compose.tailscale.yaml  # HTTPS override
├── nginx.tailscale.conf           # HTTPS nginx config
├── .env.tailscale.example         # Environment template
└── scripts/
    └── setup-tailscale-https.sh   # Automated setup
```
