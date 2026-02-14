# Pursue Segments

A web app for podcast long-form clip generation with AI-powered target audience profiling.

## Overview

Pursue Segments helps podcasters create detailed target audience profiles through an intelligent onboarding questionnaire. The system uses Google's Gemini 2.0 Flash API to generate professional audience personas that guide content strategy.

## Features

- **Onboarding Questionnaire**: 32 questions across 7 sections covering audience discovery, demographics, professional life, personal life, media consumption, psychographics, and podcast relationship
- **AI-Powered Profile Generation**: Automatically generates 400-450 word target audience profiles
- **Dashboard**: View and manage your generated audience profiles
- **Modern Design**: Dark royal blue theme inspired by Stripe/Linear

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, TypeScript
- **Backend**: Python Flask API
- **AI**: Google Gemini 2.0 Flash API
- **Database**: JSON file storage (can be upgraded to PostgreSQL)

## Project Structure

```
pursue-segments/
├── frontend/                 # Next.js frontend application
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   ├── lib/                  # Utilities and types
│   ├── package.json
│   └── .env.example          # Frontend env template
├── backend/                  # Python Flask API
│   ├── app.py               # Main Flask application
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend env template
├── README.md                # This file
├── vercel.json              # Vercel deployment config
└── .gitignore               # Git ignore rules
```

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+ 
- Python 3.9+
- Google AI Studio API key (get one at https://makersuite.google.com/app/apikey)

### 1. Clone and Navigate

```bash
cd pursue-segments
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your Gemini API key

# Start the backend
python app.py
```

The backend will run on http://localhost:5001

### 3. Setup Frontend (in a new terminal)

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local if needed (should point to localhost:5001)

# Start the development server
npm run dev
```

The frontend will run on http://localhost:3000

### 4. Open in Browser

Navigate to http://localhost:3000 to start using the app!

---

# 🚀 Deployment Guide

This app is deployed in two parts:
- **Frontend**: Vercel (serverless, free tier)
- **Backend**: Railway.app (free tier) or Render

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Vercel        │         │   Railway.app    │
│   (Frontend)    │◄────────┤   (Backend)      │
│   Next.js       │  API    │   Flask API      │
│   pursue.app    │  Calls  │   Gemini AI      │
└─────────────────┘         └──────────────────┘
```

---

## Part 1: Push Code to GitHub

### Step 1: Initialize Git Repository (if not already done)

```bash
cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Pursue Segments app"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `pursue-segments`
3. Make it **Private** (recommended for now)
4. Click **Create repository**

### Step 3: Push to GitHub

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/pursue-segments.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## Part 2: Deploy Backend to Railway.app

### Step 1: Sign Up / Log In

1. Go to https://railway.app
2. Sign up with GitHub (easiest option)
3. Complete onboarding

### Step 2: Create New Project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your `pursue-segments` repository
4. Click **Add variables** first (before deploying!)

### Step 3: Configure Environment Variables

Add these environment variables in Railway:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `FLASK_ENV` | `production` |
| `CORS_ORIGINS` | `*` (we'll update this after Vercel deploy) |
| `PORT` | `5001` (Railway auto-sets this, but good to confirm) |

> 💡 **Get your Gemini API key**: https://makersuite.google.com/app/apikey

### Step 4: Configure Deployment Settings

1. Click on the service (your backend)
2. Go to **Settings** tab
3. Set **Root Directory**: `backend`
4. Set **Start Command**: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`
5. Click **Deploy**

### Step 5: Get Backend URL

After deployment:
1. Go to your service dashboard
2. Look for the **Domain** (e.g., `https://pursue-segments-production.up.railway.app`)
3. Copy this URL - you'll need it for the frontend
4. **Test it**: Visit `https://YOUR-URL.railway.app/api/health` - should return `{"status": "healthy"}`

---

## Part 3: Deploy Frontend to Vercel

### Step 1: Sign Up / Log In

1. Go to https://vercel.com
2. Sign up with GitHub
3. Complete onboarding

### Step 2: Import Project

1. Click **Add New Project**
2. Select **Import Git Repository**
3. Choose your `pursue-segments` repo
4. Click **Import**

### Step 3: Configure Project

Vercel should auto-detect Next.js settings. Verify:

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `frontend` (click Edit and set this!) |
| Build Command | `npm run build` (default) |
| Output Directory | `.next` (default) |

### Step 4: Add Environment Variables

Add this environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway backend URL (e.g., `https://pursue-segments.up.railway.app`) |

⚠️ **Important**: Must start with `NEXT_PUBLIC_` to be available in browser

### Step 5: Deploy

1. Click **Deploy**
2. Wait for build (~2-3 minutes)
3. Once deployed, Vercel gives you a URL (e.g., `https://pursue-segments.vercel.app`)

### Step 6: Update CORS (Important!)

1. Go back to Railway dashboard
2. Update `CORS_ORIGINS` to your Vercel URL:
   - `https://pursue-segments.vercel.app` (replace with your actual URL)
3. Redeploy backend (should happen automatically)

---

## Part 4: Custom Domain (Optional)

### Vercel (Frontend)

1. Go to Vercel project → **Settings** → **Domains**
2. Add your domain (e.g., `app.pursue.ai`)
3. Follow DNS instructions

### Railway (Backend)

1. Go to Railway project → **Settings** → **Domains**
2. Click **Generate Domain** or add custom domain
3. Update `NEXT_PUBLIC_API_URL` in Vercel with new backend URL
4. Redeploy frontend

---

## 📝 Quick Reference: All Commands

### Initial Setup & Push to GitHub

```bash
cd /Users/pursuebot/.openclaw/workspace/pursue-segments
git init
git add .
git commit -m "Initial commit: Pursue Segments app"
git remote add origin https://github.com/YOUR_USERNAME/pursue-segments.git
git branch -M main
git push -u origin main
```

### Update & Redeploy

```bash
# After making changes
git add .
git commit -m "Your update message"
git push origin main

# Both Vercel and Railway auto-deploy on push!
```

---

## 🔧 Troubleshooting

### Frontend shows "API Error"

1. Check `NEXT_PUBLIC_API_URL` is set correctly in Vercel
2. Verify backend is running on Railway
3. Check CORS_ORIGINS includes your Vercel URL
4. Look at Railway logs: Dashboard → Deployments → View Logs

### Backend won't start

1. Check all environment variables are set
2. Verify `GEMINI_API_KEY` is valid
3. Check Railway logs for errors
4. Ensure `requirements.txt` includes `gunicorn`

### Build fails on Vercel

1. Check `vercel.json` is at project root
2. Verify `Root Directory` is set to `frontend`
3. Check Vercel build logs
4. Ensure `package.json` has a `build` script

---

## API Endpoints

### Health Check
- `GET /api/health` - Check if API is running

### Questionnaire
- `POST /api/questionnaire` - Submit questionnaire answers
  - Request body: `{ "podcastName": "...", "hostNames": "...", "answers": {...} }`
  - Returns: `{ "id": "...", "status": "success" }`

- `GET /api/questionnaire/:id` - Retrieve questionnaire by ID

### Profile Generation
- `POST /api/generate-profile` - Generate target audience profile
  - Request body: `{ "questionnaireId": "..." }`
  - Returns: `{ "profile": "...", "wordCount": 425 }`

- `GET /api/profile/:id` - Retrieve generated profile

---

## Environment Variables

### Backend (Railway)
```
GEMINI_API_KEY=your_gemini_api_key_here
FLASK_ENV=production
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## Questionnaire Sections

1. **Audience Discovery** (6 questions) - Who you want to reach and their challenges
2. **Demographic Basics** (5 questions) - Age, gender, location, education, income
3. **Professional Life** (4 questions) - Industry, role, decision-making, aspirations
4. **Personal Life** (5 questions) - Relationship, family, home, hobbies
5. **Media Consumption** (4 questions) - Podcast habits, social media, content preferences
6. **Psychographics** (4 questions) - Values, problems, goals, motivations
7. **Relationship to Podcast** (5 questions) - Why they choose you, value, CTAs

---

## License

MIT License - Feel free to use and modify!

## Support

For questions or issues, please open an issue on the repository.
