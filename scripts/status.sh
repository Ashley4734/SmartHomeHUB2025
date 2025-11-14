#!/bin/bash

# Smart Home Hub Status Script

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

echo -e "${GREEN}Smart Home Hub Status${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"

# Function to check service status
check_service() {
    local name=$1
    local pid_file=$2
    local url=$3

    echo -n "$name: "

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            # Check if service is responding
            if [ -n "$url" ]; then
                if curl -s "$url" > /dev/null 2>&1; then
                    echo -e "${GREEN}Running${NC} (PID: $pid) ✓"
                else
                    echo -e "${YELLOW}Running but not responding${NC} (PID: $pid)"
                fi
            else
                echo -e "${GREEN}Running${NC} (PID: $pid)"
            fi
        else
            echo -e "${RED}Not running${NC} (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        echo -e "${RED}Not running${NC}"
    fi
}

# Check backend status
check_service "Backend " "$BACKEND_PID_FILE" "http://localhost:3000/api/health"

# Check frontend status
check_service "Frontend" "$FRONTEND_PID_FILE"

echo -e "${GREEN}═══════════════════════════════════════${NC}"

# Show URLs if services are running
if [ -f "$BACKEND_PID_FILE" ] || [ -f "$FRONTEND_PID_FILE" ]; then
    echo ""
    echo "Access URLs:"
    [ -f "$FRONTEND_PID_FILE" ] && echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
    [ -f "$BACKEND_PID_FILE" ] && echo -e "  Backend:  ${GREEN}http://localhost:3000${NC}"
fi

echo ""
