# Combine frontend and backend for single Render deployment

# 1. Build frontend
cd /Users/pursuebot/.openclaw/workspace/pursue-segments/frontend
npm install
npm run build

# 2. Copy build to backend static folder
mkdir -p ../backend/static
cp -r .next/static ../backend/static/ 2>/dev/null || true

# The backend will serve frontend at root, API at /api
# ONE service, ONE URL, no CORS bullshit