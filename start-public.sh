#!/bin/bash
# Start Pursue Segments with Cloudflare Tunnel (public access)
# Run this on the Intel MacBook Pro

echo "Starting Pursue Segments with Public Access..."
echo "=============================================="
echo ""

cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Start Backend
echo "[1/3] Starting Backend on port 5001..."
cd backend
source venv/bin/activate 2>/dev/null || (python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt)
python app.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..
sleep 2

# Start Frontend  
echo "[2/3] Starting Frontend on port 3000..."
cd frontend
npm install > /tmp/npm-install.log 2>&1
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..
sleep 3

# Start Cloudflare Tunnel
echo "[3/3] Starting Cloudflare Tunnel..."
echo "This will create a public URL..."
echo ""
cloudflared tunnel --url http://localhost:3000 &
TUNNEL_PID=$!

sleep 5

echo ""
echo "=============================================="
echo "SERVERS RUNNING!"
echo "=============================================="
echo ""
echo "Look for the HTTPS URL above (e.g., https://something.trycloudflare.com)"
echo ""
echo "Give that URL to customers - they can upload files from anywhere!"
echo ""
echo "Files will be processed on THIS MacBook Pro."
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID 2>/dev/null; exit" INT
wait