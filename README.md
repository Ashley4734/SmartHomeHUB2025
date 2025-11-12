# Smart Home Hub

A powerful, AI-assisted smart home automation system built with Node.js, featuring Zigbee and Matter protocol support, multi-user authentication, and intelligent automation capabilities.

## Features

### Core Capabilities
- **Multi-Protocol Support**: Zigbee (via Sonoff dongle) and Matter devices
- **AI Integration**: Support for Ollama (local), OpenAI, Claude (Anthropic), and Google Gemini
- **Voice Control**: Wake word detection and natural language command processing
- **Intelligent Automations**: AI-assisted automation creation from natural language
- **Multi-User System**: Role-based access control (Admin, User, Guest)
- **Real-Time Updates**: WebSocket support for instant device state changes
- **Progressive Web App**: Mobile-friendly dashboard that works offline

### AI Features
- Natural language automation creation ("Turn off lights when I leave")
- Pattern learning and predictive suggestions
- Voice command processing
- Anomaly detection and optimization suggestions
- Context-aware automations

### Device Support
- **Zigbee**: Lights, switches, sensors, motion detectors, door sensors
- **Matter**: Smart home devices over WiFi/Ethernet and Thread
- **Scales**: Designed to handle hundreds of devices

## Architecture

```
smart-home-hub/
├── backend/           # Node.js server
│   ├── src/
│   │   ├── core/      # Device management
│   │   ├── protocols/ # Zigbee & Matter
│   │   ├── ai/        # AI service layer
│   │   ├── automation/# Automation engine
│   │   ├── voice/     # Voice control
│   │   ├── auth/      # Authentication
│   │   ├── api/       # REST API
│   │   └── websocket/ # Real-time updates
│   └── data/          # SQLite database
├── frontend/
│   └── web/          # React dashboard + PWA
├── scripts/          # Setup scripts
└── docs/            # Documentation
```

## Hardware Requirements

### Minimum Specs
- CPU: 2 cores, 2.6 GHz (tested on Celeron N4000)
- RAM: 4-8 GB
- Storage: 32 GB
- OS: Ubuntu 20.04 or later

### Additional Hardware
- **Sonoff Zigbee 3.0 USB Dongle** (for Zigbee support)
- Optional: Thread border router for Matter-over-Thread

## Quick Start

1. **Clone and setup**
```bash
git clone <repository-url>
cd SmartHomeHUB2025
chmod +x scripts/setup.sh
./scripts/setup.sh
```

2. **Configure** (edit `backend/.env`)
```bash
# Set your Zigbee dongle port
ZIGBEE_PORT=/dev/ttyUSB0

# Enable AI provider
OLLAMA_ENABLED=true
```

3. **Start**
```bash
./scripts/start.sh
```

4. **Access**
- Dashboard: http://localhost:5173
- Login: admin / admin123

## Full Documentation

See [README.md](./README_FULL.md) for complete installation, configuration, and usage instructions.

## Key Technologies

- **Backend**: Node.js, Express, Socket.io, SQLite
- **Frontend**: React, Vite, Tailwind CSS
- **Protocols**: zigbee-herdsman, Matter.js
- **AI**: Ollama, OpenAI, Claude, Gemini APIs

## License

MIT License