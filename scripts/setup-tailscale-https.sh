#!/bin/bash
# Zero Email - Tailscale HTTPS Setup Script
#
# This script automates the setup of HTTPS for Zero Email using Tailscale.
# Run this on your Pi or server where Zero Email will be deployed.
#
# Usage:
#   ./scripts/setup-tailscale-https.sh
#
# What this script does:
#   1. Checks if Tailscale is installed (installs if not)
#   2. Checks if Tailscale is connected
#   3. Gets your Tailscale hostname
#   4. Generates HTTPS certificates
#   5. Copies certificates to the certs/ directory
#   6. Creates a .env file from the template

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Zero Email - Tailscale HTTPS Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if running as root for cert operations
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}Note: Some operations may require sudo.${NC}"
        echo ""
    fi
}

# Check if Tailscale is installed
check_tailscale_installed() {
    if ! command -v tailscale &> /dev/null; then
        echo -e "${YELLOW}Tailscale is not installed.${NC}"
        echo ""
        read -p "Would you like to install Tailscale? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Installing Tailscale...${NC}"
            curl -fsSL https://tailscale.com/install.sh | sh
            echo -e "${GREEN}Tailscale installed successfully!${NC}"
        else
            echo -e "${RED}Tailscale is required. Please install it manually:${NC}"
            echo "  curl -fsSL https://tailscale.com/install.sh | sh"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Tailscale is installed${NC}"
    fi
}

# Check if Tailscale is connected
check_tailscale_connected() {
    if ! tailscale status &> /dev/null; then
        echo -e "${YELLOW}Tailscale is not connected.${NC}"
        echo ""
        echo "Please run: sudo tailscale up"
        echo "Then authenticate in your browser."
        echo ""
        read -p "Press Enter after you've connected Tailscale..." -r
    fi

    # Verify connection
    if tailscale status &> /dev/null; then
        echo -e "${GREEN}✓ Tailscale is connected${NC}"
    else
        echo -e "${RED}Tailscale is still not connected. Please connect and try again.${NC}"
        exit 1
    fi
}

# Get Tailscale hostname
get_hostname() {
    TAILSCALE_HOSTNAME=$(tailscale status --json | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')

    if [ -z "$TAILSCALE_HOSTNAME" ]; then
        echo -e "${RED}Could not determine Tailscale hostname.${NC}"
        echo "Please ensure MagicDNS is enabled in your Tailscale admin console:"
        echo "  https://login.tailscale.com/admin/dns"
        exit 1
    fi

    echo -e "${GREEN}✓ Tailscale hostname: ${TAILSCALE_HOSTNAME}${NC}"
}

# Generate HTTPS certificates
generate_certs() {
    echo ""
    echo -e "${BLUE}Generating HTTPS certificates...${NC}"

    # Create certs directory
    mkdir -p "$PROJECT_DIR/certs"

    # Generate certificates using Tailscale
    # Note: This requires HTTPS to be enabled in Tailscale admin console
    if sudo tailscale cert "$TAILSCALE_HOSTNAME" 2>/dev/null; then
        echo -e "${GREEN}✓ Certificates generated${NC}"
    else
        echo -e "${YELLOW}Certificate generation failed.${NC}"
        echo ""
        echo "Please ensure HTTPS is enabled in your Tailscale admin console:"
        echo "  1. Go to https://login.tailscale.com/admin/dns"
        echo "  2. Enable 'HTTPS Certificates'"
        echo "  3. Run this script again"
        echo ""
        echo "Alternatively, generate certificates manually:"
        echo "  sudo tailscale cert $TAILSCALE_HOSTNAME"
        exit 1
    fi

    # Copy certificates to project directory
    CERT_SRC="/var/lib/tailscale/certs"
    if [ -f "$CERT_SRC/${TAILSCALE_HOSTNAME}.crt" ]; then
        sudo cp "$CERT_SRC/${TAILSCALE_HOSTNAME}.crt" "$PROJECT_DIR/certs/server.crt"
        sudo cp "$CERT_SRC/${TAILSCALE_HOSTNAME}.key" "$PROJECT_DIR/certs/server.key"
        sudo chown "$USER:$USER" "$PROJECT_DIR/certs/server.crt" "$PROJECT_DIR/certs/server.key"
        chmod 644 "$PROJECT_DIR/certs/server.crt"
        chmod 600 "$PROJECT_DIR/certs/server.key"
        echo -e "${GREEN}✓ Certificates copied to certs/ directory${NC}"
    else
        # Try alternative location
        if [ -f "${TAILSCALE_HOSTNAME}.crt" ]; then
            mv "${TAILSCALE_HOSTNAME}.crt" "$PROJECT_DIR/certs/server.crt"
            mv "${TAILSCALE_HOSTNAME}.key" "$PROJECT_DIR/certs/server.key"
            chmod 644 "$PROJECT_DIR/certs/server.crt"
            chmod 600 "$PROJECT_DIR/certs/server.key"
            echo -e "${GREEN}✓ Certificates moved to certs/ directory${NC}"
        else
            echo -e "${RED}Could not find generated certificates.${NC}"
            echo "Please copy them manually to:"
            echo "  $PROJECT_DIR/certs/server.crt"
            echo "  $PROJECT_DIR/certs/server.key"
            exit 1
        fi
    fi
}

# Create .env file from template
create_env_file() {
    echo ""
    echo -e "${BLUE}Creating .env file...${NC}"

    if [ -f "$PROJECT_DIR/.env" ]; then
        echo -e "${YELLOW}Existing .env file found.${NC}"
        read -p "Would you like to create .env.tailscale instead? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ENV_FILE="$PROJECT_DIR/.env.tailscale"
        else
            echo "Skipping .env creation. Please update your .env manually."
            return
        fi
    else
        ENV_FILE="$PROJECT_DIR/.env"
    fi

    # Create .env from template with hostname substituted
    if [ -f "$PROJECT_DIR/.env.tailscale.example" ]; then
        sed "s/<your-hostname>.ts.net/${TAILSCALE_HOSTNAME}/g" "$PROJECT_DIR/.env.tailscale.example" > "$ENV_FILE"
        echo -e "${GREEN}✓ Created $ENV_FILE${NC}"
        echo ""
        echo -e "${YELLOW}IMPORTANT: Edit $ENV_FILE to add your:${NC}"
        echo "  - GOOGLE_CLIENT_ID"
        echo "  - GOOGLE_CLIENT_SECRET"
        echo "  - BETTER_AUTH_SECRET (generate with: openssl rand -hex 32)"
        echo "  - Database passwords"
    else
        echo -e "${RED}Template file .env.tailscale.example not found.${NC}"
    fi
}

# Print Google OAuth instructions
print_oauth_instructions() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}Google OAuth Configuration${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    echo "Add these to your Google Cloud Console OAuth credentials:"
    echo ""
    echo -e "${GREEN}Authorized JavaScript origins:${NC}"
    echo "  https://${TAILSCALE_HOSTNAME}"
    echo ""
    echo -e "${GREEN}Authorized redirect URIs:${NC}"
    echo "  https://${TAILSCALE_HOSTNAME}/api/auth/callback/google"
    echo ""
    echo "Google Cloud Console: https://console.cloud.google.com/apis/credentials"
}

# Print deployment instructions
print_deployment_instructions() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}Deployment Instructions${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    echo "1. Edit your .env file with the required values"
    echo ""
    echo "2. Build the frontend:"
    echo "   cd apps/mail && bun run build"
    echo ""
    echo "3. Start the services:"
    echo ""
    echo "   # Standalone deployment:"
    echo "   docker compose -f docker-compose.standalone.yaml -f docker-compose.tailscale.yaml up -d"
    echo ""
    echo "   # Pi deployment (with shared MinIO):"
    echo "   docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml -f docker-compose.tailscale.yaml up -d"
    echo ""
    echo "4. Access Zero Email at:"
    echo "   https://${TAILSCALE_HOSTNAME}"
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
}

# Main execution
main() {
    check_sudo
    check_tailscale_installed
    check_tailscale_connected
    get_hostname
    generate_certs
    create_env_file
    print_oauth_instructions
    print_deployment_instructions
}

main
