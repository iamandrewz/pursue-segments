# Pursue Segments - Local Mac Setup

## Run Everything on Your MacBook Pro

### 1. Start Backend (Terminal 1)
```bash
cd /Users/pursuebot/.openclaw/workspace/pursue-segments/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```
Backend runs at: `http://localhost:5001`

### 2. Start Frontend (Terminal 2)
```bash
cd /Users/pursuebot/.openclaw/workspace/pursue-segments/frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:3000`

### 3. Open in Browser
Go to: `http://localhost:3000`

## Features
- ✅ File upload (NO size limits)
- ✅ YouTube download (your IP, no bot detection)
- ✅ Whisper transcription
- ✅ Gemini clip analysis

## When Mac Mini Arrives (Feb 20)
Just copy this folder to the Mac Mini, run same commands. Done.

## Stop Paying for Cloud
- Render: Cancel subscription
- Vercel: Already deleted
- Netlify: Already deleted

**Total cost: $0**
**File size limit: Your hard drive**
**YouTube blocking: Never (your residential IP)**