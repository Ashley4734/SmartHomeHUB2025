#!/bin/bash

# Smart Home Hub Start Script
set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Smart Home Hub...${NC}"

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"
echo "Working directory: $PROJECT_ROOT"

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

# Check and install backend dependencies
echo "Checking backend dependencies..."
check_dependencies "backend"

# Check and install frontend dependencies
echo "Checking frontend dependencies..."
check_dependencies "frontend/web"

# Start backend
echo -e "${GREEN}Starting backend...${NC}"
cd backend
npm start &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to start and check health
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is running (PID: $BACKEND_PID)${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend failed to start after 30 seconds${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start frontend
echo -e "${GREEN}Starting frontend...${NC}"
cd frontend/web
npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}Smart Home Hub is running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:3000${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Backend PID:  $BACKEND_PID"
echo -e "  Frontend PID: $FRONTEND_PID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Default login credentials:${NC}"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"
echo ""

# Trap Ctrl+C and stop both processes
trap "echo -e '\n${YELLOW}Stopping services...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" INT TERM

# Wait for processes
wait
