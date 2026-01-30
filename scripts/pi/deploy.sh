#!/bin/bash
# Zero Email - Deploy Script for Raspberry Pi
#
# This script syncs the project to your Raspberry Pi and starts the services.
# Run build.sh first to build the frontend.
#
# Usage:
#   PI_HOST=raspberrypi.local ./scripts/pi/deploy.sh
#   PI_HOST=192.168.1.100 PI_USER=pi ./scripts/pi/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration (can be overridden via environment variables)
PI_HOST="${PI_HOST:-raspberrypi.local}"
PI_USER="${PI_USER:-pi}"
PI_PATH="${PI_PATH:-/home/$PI_USER/zero}"
SSH_KEY="${SSH_KEY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Build SSH command with optional key
ssh_cmd() {
    if [ -n "$SSH_KEY" ]; then
        ssh -i "$SSH_KEY" "$PI_USER@$PI_HOST" "$@"
    else
        ssh "$PI_USER@$PI_HOST" "$@"
    fi
}

# Build rsync command with optional key
rsync_cmd() {
    if [ -n "$SSH_KEY" ]; then
        rsync -e "ssh -i $SSH_KEY" "$@"
    else
        rsync "$@"
    fi
}

cd "$PROJECT_ROOT"

echo ""
echo "========================================"
echo "  Zero Email - Raspberry Pi Deployment"
echo "========================================"
echo ""
log_info "Target: $PI_USER@$PI_HOST:$PI_PATH"
echo ""

# Check if build exists
if [ ! -d "apps/mail/build/client" ]; then
    log_error "Frontend build not found. Run ./scripts/pi/build.sh first."
    exit 1
fi

# Test SSH connection
log_step "Testing SSH connection..."
if ! ssh_cmd "echo 'SSH connection successful'" 2>/dev/null; then
    log_error "Cannot connect to $PI_HOST"
    log_info "Make sure:"
    log_info "  1. Your Pi is powered on and connected to the network"
    log_info "  2. SSH is enabled on the Pi"
    log_info "  3. You can ping the Pi: ping $PI_HOST"
    log_info "  4. Your SSH key is set up, or use: ssh-copy-id $PI_USER@$PI_HOST"
    exit 1
fi

# Check if Docker is installed on Pi
log_step "Checking Docker installation on Pi..."
if ! ssh_cmd "command -v docker" &>/dev/null; then
    log_warn "Docker not found on Pi. Installing..."
    ssh_cmd "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker \$USER"
    log_info "Docker installed. You may need to log out and back in on the Pi."
    log_info "Then run this script again."
    exit 0
fi

# Create target directory on Pi
log_step "Creating deployment directory..."
ssh_cmd "mkdir -p $PI_PATH"

# Sync files to Pi
log_step "Syncing files to Pi (this may take a few minutes)..."
rsync_cmd -avz --progress --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.turbo' \
    --exclude '.wrangler' \
    --exclude '*.tsbuildinfo' \
    --exclude '.env' \
    --exclude '.env.pi' \
    --exclude '.dev.vars' \
    --include 'apps/mail/build/***' \
    --include 'apps/server/src/***' \
    --include 'apps/server/package.json' \
    --include 'apps/server/drizzle.config.ts' \
    --include 'apps/mail/package.json' \
    --exclude 'apps/mail/*' \
    --include 'packages/***' \
    --include 'docker/***' \
    --include 'patches/***' \
    --include 'scripts/pi/***' \
    --exclude 'scripts/*' \
    "$PROJECT_ROOT/" "$PI_USER@$PI_HOST:$PI_PATH/"

# Check if .env.pi exists on Pi, if not copy the example
log_step "Checking environment configuration..."
if ! ssh_cmd "test -f $PI_PATH/.env.pi"; then
    log_warn "No .env.pi found on Pi. Copying example file..."
    ssh_cmd "cp $PI_PATH/.env.pi.example $PI_PATH/.env.pi"
    log_warn ""
    log_warn "IMPORTANT: Edit the environment file on the Pi before starting:"
    log_warn "  ssh $PI_USER@$PI_HOST"
    log_warn "  nano $PI_PATH/.env.pi"
    log_warn ""
    log_warn "At minimum, you need to set:"
    log_warn "  - GOOGLE_CLIENT_ID"
    log_warn "  - GOOGLE_CLIENT_SECRET"
    log_warn "  - BETTER_AUTH_SECRET"
    log_warn ""
    read -p "Press Enter once you've configured .env.pi, or Ctrl+C to exit..."
fi

# Create symlink for docker-compose env file
ssh_cmd "cd $PI_PATH && ln -sf .env.pi .env"

# Build and start services
log_step "Building and starting Docker services..."
ssh_cmd "cd $PI_PATH && docker compose -f docker-compose.pi.yaml build"

log_step "Starting services..."
ssh_cmd "cd $PI_PATH && docker compose -f docker-compose.pi.yaml up -d"

# Wait for services to be healthy
log_step "Waiting for services to start..."
sleep 10

# Check service status
log_step "Checking service status..."
ssh_cmd "cd $PI_PATH && docker compose -f docker-compose.pi.yaml ps"

# Get Pi IP address for easy access
PI_IP=$(ssh_cmd "hostname -I | awk '{print \$1}'" 2>/dev/null || echo "$PI_HOST")

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
log_info "Zero Email is now running on your Raspberry Pi!"
echo ""
log_info "Access the app at:"
log_info "  http://$PI_HOST:3000"
if [ "$PI_IP" != "$PI_HOST" ]; then
    log_info "  http://$PI_IP:3000"
fi
echo ""
log_info "Useful commands (run on Pi):"
log_info "  View logs:    cd ~/zero && docker compose -f docker-compose.pi.yaml logs -f"
log_info "  Stop:         cd ~/zero && docker compose -f docker-compose.pi.yaml down"
log_info "  Restart:      cd ~/zero && docker compose -f docker-compose.pi.yaml restart"
log_info "  Status:       cd ~/zero && docker compose -f docker-compose.pi.yaml ps"
echo ""
log_info "To enable auto-start on boot:"
log_info "  sudo cp ~/zero/scripts/pi/zero.service /etc/systemd/system/"
log_info "  sudo systemctl enable zero.service"
log_info "  sudo systemctl start zero.service"
echo ""
