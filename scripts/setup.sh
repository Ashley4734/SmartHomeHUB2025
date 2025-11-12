#!/bin/bash

# Smart Home Hub Setup Script
# This script helps set up the Smart Home Hub on a fresh Ubuntu installation

set -e

echo "╔════════════════════════════════════════╗"
echo "║   Smart Home Hub - Setup Script       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if running on Ubuntu
if [ ! -f /etc/lsb-release ]; then
    echo "⚠️  This script is designed for Ubuntu. Continuing anyway..."
fi

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please don't run this script as root"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"

# Install build essentials
echo "📦 Installing build essentials..."
sudo apt install -y build-essential python3 python3-pip git

# Install Ollama (optional)
echo ""
read -p "Install Ollama for local AI? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "✓ Ollama installed. You can pull models with: ollama pull llama2:7b"
fi

# Setup USB permissions for Zigbee dongle
echo ""
echo "🔌 Setting up USB permissions for Zigbee dongle..."
sudo usermod -a -G dialout $USER
echo "✓ Added $USER to dialout group"
echo "⚠️  You may need to log out and back in for this to take effect"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend/web
npm install
cd ../..

# Create .env file
echo ""
echo "⚙️  Creating .env file..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo "⚠️  Please edit backend/.env to configure your settings"
else
    echo "⚠️  backend/.env already exists, skipping..."
fi

# Create data directories
echo ""
echo "📁 Creating data directories..."
mkdir -p backend/data/{zigbee,matter}
mkdir -p backend/logs

# Setup systemd service (optional)
echo ""
read -p "Install systemd service for auto-start? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    INSTALL_DIR=$(pwd)
    SERVICE_FILE="/etc/systemd/system/smart-home-hub.service"

    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Smart Home Hub
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable smart-home-hub.service
    echo "✓ Systemd service installed"
    echo "  Start with: sudo systemctl start smart-home-hub"
    echo "  Check status: sudo systemctl status smart-home-hub"
    echo "  View logs: sudo journalctl -u smart-home-hub -f"
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     Setup Complete!                    ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env to configure your settings"
echo "2. Configure your Zigbee dongle port in .env (default: /dev/ttyUSB0)"
echo "3. Configure AI providers (Ollama, OpenAI, Claude, or Gemini)"
echo "4. Start the backend: cd backend && npm start"
echo "5. Start the frontend: cd frontend/web && npm run dev"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo "  ⚠️  Change these immediately after first login!"
echo ""
