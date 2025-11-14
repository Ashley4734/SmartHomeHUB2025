#!/bin/bash

# Smart Home Hub Stop Script

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# PID file locations
BACKEND_PID_FILE="$PROJECT_ROOT/backend/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/frontend/web/.frontend.pid"

echo -e "${YELLOW}Stopping Smart Home Hub...${NC}"

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            sleep 2

            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "${YELLOW}Force stopping $name...${NC}"
                kill -9 "$pid" 2>/dev/null
            fi

            echo -e "${GREEN}✓ $name stopped${NC}"
        else
            echo -e "${YELLOW}$name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}$name PID file not found${NC}"
    fi
}

# Stop backend
stop_service "Backend" "$BACKEND_PID_FILE"

# Stop frontend
stop_service "Frontend" "$FRONTEND_PID_FILE"

# Also kill any lingering node processes
pkill -f "node.*src/index.js" 2>/dev/null
pkill -f "npm.*dev" 2>/dev/null

echo ""
echo -e "${GREEN}Smart Home Hub stopped${NC}"
