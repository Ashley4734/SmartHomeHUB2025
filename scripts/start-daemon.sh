#!/bin/bash

# Smart Home Hub Daemon Start Script
# This script starts services as background daemons that persist after the script exits

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# PID file locations
BACKEND_PID_FILE="$PROJECT_ROOT/backend/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/frontend/web/.frontend.pid"

# Log file locations
BACKEND_LOG="$PROJECT_ROOT/backend/logs/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/frontend/web/logs/frontend.log"

echo -e "${GREEN}Starting Smart Home Hub (Daemon Mode)...${NC}"

# Change to project root
cd "$PROJECT_ROOT"

# Function to check if dependencies are installed
check_dependencies() {
    local dir=$1
    if [ ! -d "$dir/node_modules" ]; then
        echo -e "${YELLOW}Dependencies not found in $dir${NC}"
        echo "Installing dependencies..."
        cd "$dir"
        npm install
        cd "$PROJECT_ROOT"
    fi
}

# Function to check if a process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Process is running
        fi
    fi
    return 1  # Process is not running
}

# Check if backend is already running
if is_running "$BACKEND_PID_FILE"; then
    echo -e "${YELLOW}Backend is already running (PID: $(cat $BACKEND_PID_FILE))${NC}"
else
    # Check and install backend dependencies
    echo "Checking backend dependencies..."
    check_dependencies "backend"

    # Create log directory
    mkdir -p "$PROJECT_ROOT/backend/logs"

    # Start backend
    echo -e "${GREEN}Starting backend...${NC}"
    cd "$PROJECT_ROOT"
    # Use setsid to create new session and fully detach
    setsid "$SCRIPT_DIR/start-backend.sh" < /dev/null >> "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"

    # Wait for backend to start
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is running (PID: $BACKEND_PID)${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ Backend failed to start after 30 seconds${NC}"
            echo -e "${YELLOW}Check logs: $BACKEND_LOG${NC}"
            rm -f "$BACKEND_PID_FILE"
            exit 1
        fi
        sleep 1
    done
fi

# Check if frontend is already running
if is_running "$FRONTEND_PID_FILE"; then
    echo -e "${YELLOW}Frontend is already running (PID: $(cat $FRONTEND_PID_FILE))${NC}"
else
    # Check and install frontend dependencies
    echo "Checking frontend dependencies..."
    check_dependencies "frontend/web"

    # Create log directory
    mkdir -p "$PROJECT_ROOT/frontend/web/logs"

    # Start frontend
    echo -e "${GREEN}Starting frontend...${NC}"
    cd "$PROJECT_ROOT"
    # Use setsid to create new session and fully detach
    setsid "$SCRIPT_DIR/start-frontend.sh" < /dev/null >> "$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$FRONTEND_PID_FILE"

    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Smart Home Hub is running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  Backend PID:  $(cat $BACKEND_PID_FILE 2>/dev/null || echo 'N/A')"
echo -e "  Frontend PID: $(cat $FRONTEND_PID_FILE 2>/dev/null || echo 'N/A')"
echo ""
echo -e "${YELLOW}Default login credentials:${NC}"
echo "  Username: ${GREEN}admin${NC}"
echo "  Password: ${GREEN}admin123${NC}"
echo ""
echo -e "${YELLOW}Management commands:${NC}"
echo "  Stop:   ./scripts/stop.sh"
echo "  Status: ./scripts/status.sh"
echo "  Logs:   tail -f $BACKEND_LOG"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
