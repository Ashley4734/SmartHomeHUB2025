#!/bin/bash

# Smart Home Hub Start Script

echo "Starting Smart Home Hub..."

# Start backend
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
cd ../frontend/web
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Smart Home Hub is starting..."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Access the dashboard at: http://localhost:5173"
echo "API available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"

# Trap Ctrl+C and stop both processes
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Wait for processes
wait
