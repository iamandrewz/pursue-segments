#!/bin/bash
# Start Pursue Segments with Cloudflare Tunnel (frontend + backend)
# RUN THIS ON INTEL MACBOOK PRO

echo "Starting Pursue Segments with Public Access..."
echo "=============================================="
echo ""

cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Update frontend to use relative API URL (same domain)
echo "[0/4] Updating frontend to use relative API path..."
sed -i.bak "s|const API_URL = 'http://localhost:5001';|const API_URL = '';|" frontend/lib/api.ts
cd frontend
npm install > /tmp/npm-install.log 2>&1
npm run build > /tmp/npm-build.log 2>&1 &
BUILD_PID=$!
cd ..

# Start Backend
echo "[1/4] Starting Backend on port 5001..."
cd backend
source venv/bin/activate 2>/dev/null || (python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt)

# Update CORS to allow all origins for now
export CORS_ORIGINS="*"
python app.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..
sleep 3

# Start Frontend (production build)
echo "[2/4] Starting Frontend on port 3000..."
cd frontend
npx serve@latest out -p 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..
sleep 3

# Start Cloudflare Tunnel for backend API
echo "[3/4] Starting Cloudflare Tunnel for API..."
cloudflared tunnel --url http://localhost:5001 > /tmp/tunnel-api.log 2>&1 &
TUNNEL_API_PID=$!
sleep 5

# Start Cloudflare Tunnel for frontend
echo "[4/4] Starting Cloudflare Tunnel for Frontend..."
echo ""
cloudflared tunnel --url http://localhost:3000

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID $TUNNEL_API_PID 2>/dev/null; exit" INT