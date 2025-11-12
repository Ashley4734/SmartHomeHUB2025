# Installation Guide

## Prerequisites

- Ubuntu 20.04 or later (tested on Ubuntu)
- Mini PC with at least 2-core CPU, 4GB RAM
- Sonoff Zigbee 3.0 USB Dongle
- Internet connection for initial setup

## Step-by-Step Installation

### 1. System Preparation

Update your system:
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Run Setup Script

The easiest way to install:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will automatically:
- Install Node.js 20.x
- Install build tools
- Set up USB permissions
- Install dependencies
- Create configuration files
- Optionally install Ollama and systemd service

### 3. Manual Installation (Alternative)

If you prefer manual installation:

#### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Install Dependencies
```bash
sudo apt install -y build-essential python3 git

# Backend
cd backend
npm install

# Frontend
cd ../frontend/web
npm install
```

#### Setup USB Permissions
```bash
sudo usermod -a -G dialout $USER
# Log out and back in
```

#### Install Ollama (Optional)
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama2:7b
```

### 4. Configuration

Copy and edit environment file:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Essential configuration:
```bash
# Zigbee dongle
ZIGBEE_ENABLED=true
ZIGBEE_PORT=/dev/ttyUSB0  # Your dongle path

# AI Provider (choose one or more)
OLLAMA_ENABLED=true
DEFAULT_AI_PROVIDER=ollama

# Security
JWT_SECRET=<generate-a-random-secret>
```

### 5. First Start

#### Option A: Manual Start
```bash
# Terminal 1
cd backend
npm start

# Terminal 2
cd frontend/web
npm run dev
```

#### Option B: Using Script
```bash
./scripts/start.sh
```

#### Option C: Systemd Service
```bash
sudo systemctl start smart-home-hub
sudo systemctl enable smart-home-hub  # Auto-start on boot
```

### 6. Access Dashboard

Open browser:
- Dashboard: http://localhost:5173
- API: http://localhost:3000

Login with:
- Username: `admin`
- Password: `admin123`

**IMPORTANT:** Change the password immediately!

## Troubleshooting

### Zigbee Dongle Not Found

Check if connected:
```bash
lsusb
ls -la /dev/ttyUSB*
```

Check permissions:
```bash
groups  # Should show 'dialout'
```

### Port Already in Use

If port 3000 or 5173 is in use:
```bash
# Find process
sudo lsof -i :3000

# Kill it
sudo kill -9 <PID>
```

### Ollama Not Working

```bash
# Check if running
systemctl status ollama

# Restart
sudo systemctl restart ollama

# Test
curl http://localhost:11434/api/tags
```

### Database Errors

Reset database:
```bash
cd backend
rm -rf data/smart-home.db*
npm start  # Will recreate
```

## Next Steps

1. Configure your AI provider
2. Pair your first device
3. Create your first automation
4. Set up voice control (optional)

See the main README for usage instructions.
