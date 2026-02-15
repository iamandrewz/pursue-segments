#!/bin/bash
# Start Pursue Segments - Public Access with API Proxy

echo "=============================================="
echo "Pursue Segments - Public Server"
echo "=============================================="
echo ""

cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Step 1: Build frontend with API proxy
echo "[1/3] Building frontend..."
cd frontend

# Update API to use relative path (works through same domain)
echo "Updating API config..."
sed -i.bak 's|const API_URL = .*|const API_URL = "";|' lib/api.ts

npm install > /dev/null 2>&1
npm run build

cd ..

# Step 2: Start backend
echo "[2/3] Starting backend..."
cd backend
source venv/bin/activate 2>/dev/null || (python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt)
python app.py &
BACKEND_PID=$!
echo "Backend running on PID: $BACKEND_PID"
cd ..

sleep 3

# Step 3: Start tunnel
echo "[3/3] Creating public tunnel..."
echo ""
echo "Your public URL will appear below:"
echo ""
cloudflared tunnel --url http://localhost:5001

# Cleanup
trap "kill $BACKEND_PID 2>/dev/null; exit" INT