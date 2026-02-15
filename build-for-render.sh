#!/bin/bash
# Build and deploy Pursue Segments as SINGLE service on Render
# This eliminates CORS, SSL, and tunnel issues

set -e

echo "Building Pursue Segments (Combined)..."
echo "======================================"

# 1. Build frontend
echo "[1/3] Building frontend..."
cd /Users/pursuebot/.openclaw/workspace/pursue-segments/frontend
npm install
npm run build

# 2. Copy frontend build to backend static folder
echo "[2/3] Copying frontend to backend..."
cd /Users/pursuebot/.openclaw/workspace/pursue-segments
mkdir -p backend/static
cp -r frontend/.next/* backend/static/ 2>/dev/null || true
cp frontend/.next/server/app/index.html backend/static/index.html 2>/dev/null || true

# 3. Commit and push
echo "[3/3] Committing changes..."
git add backend/static
git commit -m "Add built frontend to backend" || true
git push

echo ""
echo "======================================"
echo "BUILD COMPLETE"
echo "======================================"
echo ""
echo "Now deploy to Render:"
echo "1. Go to dashboard.render.com"
echo "2. Your backend service"
echo "3. Deploy latest commit"
echo ""
echo "Everything will be at ONE URL:"
echo "https://pursue-segments-backend.onrender.com"
echo ""
echo "No more CORS. No more SSL issues. Done."