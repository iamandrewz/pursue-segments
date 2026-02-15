#!/bin/bash
# Start Pursue Segments on Intel MacBook Pro
# Run this on the Intel MacBook, then access from your Working MacBook

echo "Starting Pursue Segments Local Server..."
echo "======================================"
echo ""

# Get this Mac's IP address
IP_ADDRESS=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "This Mac's IP Address: $IP_ADDRESS"
echo ""

cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Start Backend (Terminal 1)
echo "Starting Backend on port 5001..."
echo "Backend will be available at: http://$IP_ADDRESS:5001"
echo ""
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python app.py &
BACKEND_PID=$!
cd ..

echo "Backend started with PID: $BACKEND_PID"
echo ""

# Start Frontend (Terminal 2)  
echo "Starting Frontend on port 3000..."
echo "Frontend will be available at: http://$IP_ADDRESS:3000"
echo ""
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Frontend started with PID: $FRONTEND_PID"
echo ""
echo "======================================"
echo "SERVER READY!"
echo "======================================"
echo ""
echo "From your Working MacBook Pro, open:"
echo "  http://$IP_ADDRESS:3000"
echo ""
echo "Upload files and they'll process on THIS MacBook."
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait