#!/bin/bash
# Zero Email - Build Script for Raspberry Pi Deployment
#
# This script builds the frontend assets on your development machine.
# Run this before deploying to your Raspberry Pi.
#
# Usage: ./scripts/pi/build.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

cd "$PROJECT_ROOT"

log_info "Building Zero Email for Raspberry Pi deployment..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed. Please install it first: npm install -g pnpm"
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 22 or later."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js version 20 or later is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies
log_info "Installing dependencies..."
pnpm install --frozen-lockfile

# Set environment variables for build
export NODE_ENV=production
export DOCKER_BUILD=true

# Use Pi URLs for the build
# These can be overridden at runtime via nginx proxy
export VITE_PUBLIC_APP_URL="http://raspberrypi.local:3000"
export VITE_PUBLIC_BACKEND_URL="http://raspberrypi.local:3000/api"

# Build the frontend
log_info "Building frontend (apps/mail)..."
cd "$PROJECT_ROOT/apps/mail"
pnpm run build

# Verify build output exists
if [ ! -d "$PROJECT_ROOT/apps/mail/build/client" ]; then
    log_error "Build failed: apps/mail/build/client directory not found"
    exit 1
fi

# Count built files
FILE_COUNT=$(find "$PROJECT_ROOT/apps/mail/build/client" -type f | wc -l | tr -d ' ')
log_info "Frontend build complete: $FILE_COUNT files"

# Return to project root
cd "$PROJECT_ROOT"

# Create a tarball for easy transfer (optional)
if [ "$1" == "--tarball" ]; then
    log_info "Creating deployment tarball..."

    TARBALL_NAME="zero-pi-$(date +%Y%m%d-%H%M%S).tar.gz"

    tar -czf "$TARBALL_NAME" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.turbo' \
        --exclude='.wrangler' \
        --exclude='*.tsbuildinfo' \
        apps/mail/build \
        apps/server/src \
        apps/server/package.json \
        packages \
        docker/pi \
        docker/db \
        docker-compose.pi.yaml \
        nginx.pi.conf \
        wrangler.pi.toml \
        .env.pi.example \
        scripts/pi \
        package.json \
        pnpm-lock.yaml \
        pnpm-workspace.yaml \
        turbo.json \
        patches

    log_info "Tarball created: $TARBALL_NAME"
    log_info "Transfer to Pi with: scp $TARBALL_NAME pi@raspberrypi.local:~/"
fi

log_info ""
log_info "Build complete! Next steps:"
log_info "  1. Run: ./scripts/pi/deploy.sh"
log_info "  2. Or manually sync: rsync -avz --delete \\"
log_info "       --exclude 'node_modules' --exclude '.git' \\"
log_info "       . pi@raspberrypi.local:~/zero/"
log_info ""
