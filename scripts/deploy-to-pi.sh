#!/bin/bash
# Deploy Zero Email to Raspberry Pi
#
# This script performs the initial deployment of Zero Email to a Raspberry Pi.
# After initial deployment, CI/CD via GitHub Actions handles updates.
#
# Prerequisites:
#   - SSH access to the Pi (ssh david@192.168.7.14)
#   - Docker installed on the Pi
#   - statement-parser running on the Pi with MinIO (ports 9000/9001)
#
# Usage:
#   ./scripts/deploy-to-pi.sh

set -e

# Configuration
PI_HOST="${PI_HOST:-david@192.168.7.14}"
PI_APP_DIR="${PI_APP_DIR:-/home/david/apps/zero-email}"
REPO_URL="${REPO_URL:-https://github.com/Mail-0/Zero.git}"

echo "========================================"
echo "Zero Email - Raspberry Pi Deployment"
echo "========================================"
echo ""
echo "Target: ${PI_HOST}:${PI_APP_DIR}"
echo ""

# Check SSH connectivity
echo "Checking SSH connectivity..."
if ! ssh -o ConnectTimeout=5 "${PI_HOST}" "echo 'SSH connection successful'"; then
    echo "ERROR: Cannot connect to ${PI_HOST}"
    echo "Make sure SSH is configured and the Pi is reachable."
    exit 1
fi

# Check if Docker is installed on Pi
echo "Checking Docker installation..."
if ! ssh "${PI_HOST}" "docker --version" &>/dev/null; then
    echo "ERROR: Docker is not installed on the Pi."
    echo "Install Docker first: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Create app directory on Pi
echo "Creating app directory..."
ssh "${PI_HOST}" "mkdir -p ${PI_APP_DIR}"

# Sync files to Pi (excluding large/unnecessary files)
echo "Syncing files to Pi..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude '*.log' \
    --exclude '.env' \
    --exclude '.env.local' \
    ./ "${PI_HOST}:${PI_APP_DIR}/"

# Initialize git repo on Pi for CI/CD
echo "Initializing git repository..."
ssh "${PI_HOST}" << EOF
cd ${PI_APP_DIR}
if [ ! -d .git ]; then
    git init
    git remote add origin ${REPO_URL}
fi
git fetch origin main
git checkout -B main
git branch --set-upstream-to=origin/main main
EOF

# Copy environment template
echo "Setting up environment file..."
ssh "${PI_HOST}" << EOF
cd ${PI_APP_DIR}
if [ ! -f .env ]; then
    cp .env.pi.example .env
    echo ""
    echo "IMPORTANT: Edit .env file with your settings:"
    echo "  nano ${PI_APP_DIR}/.env"
    echo ""
    echo "Required settings:"
    echo "  - BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)"
    echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "  - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    echo ""
fi
EOF

# Create threads bucket in MinIO if it doesn't exist
echo "Checking MinIO bucket..."
ssh "${PI_HOST}" << 'EOF'
# Check if MinIO is accessible
if curl -sf http://localhost:9000/minio/health/live &>/dev/null; then
    echo "MinIO is running"
    # Note: Bucket creation requires mc client or API call
    # User should create 'threads' bucket via MinIO console at http://192.168.7.14:9001
else
    echo "WARNING: MinIO is not running on localhost:9000"
    echo "Make sure statement-parser's MinIO is running"
fi
EOF

# Start services
echo ""
echo "Starting Zero Email services..."
ssh "${PI_HOST}" << EOF
cd ${PI_APP_DIR}
docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml up -d --build
EOF

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Check health
echo "Checking service health..."
if ssh "${PI_HOST}" "curl -sf http://localhost:3001/health" &>/dev/null; then
    echo ""
    echo "========================================"
    echo "Deployment successful!"
    echo "========================================"
    echo ""
    echo "Access Zero Email at:"
    echo "  http://192-168-7-14.nip.io:3001"
    echo ""
    echo "MinIO Console (shared):"
    echo "  http://192.168.7.14:9001"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env on the Pi with your secrets"
    echo "  2. Create 'threads' bucket in MinIO console"
    echo "  3. Set up Google OAuth credentials"
    echo "  4. Restart services: docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml restart"
    echo ""
else
    echo ""
    echo "WARNING: Health check failed. Check logs with:"
    echo "  ssh ${PI_HOST} 'cd ${PI_APP_DIR} && docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml logs -f'"
fi
