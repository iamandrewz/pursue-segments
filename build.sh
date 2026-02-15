#!/bin/bash
# Render build script - combines frontend and backend

set -e

echo "=== Building Pursue Segments ==="

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Copy frontend build to backend
echo "Copying frontend to backend..."
mkdir -p backend/static
cp -r frontend/.next backend/static/

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
pip install -r requirements.txt

echo "=== Build complete ==="