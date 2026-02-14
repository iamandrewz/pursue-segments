# 🚀 Quick Deployment Guide

Get Pursue Segments live in 15 minutes.

## What You're Deploying

| Service | Platform | Purpose |
|---------|----------|---------|
| Frontend | Vercel | Next.js app (what users see) |
| Backend | Railway.app | Flask API + AI processing |

---

## Step 1: Push Code to GitHub

```bash
cd /Users/pursuebot/.openclaw/workspace/pursue-segments

# Initialize and commit
git init
git add .
git commit -m "Initial commit: Pursue Segments app"

# Create repo on https://github.com/new (name: pursue-segments, Private)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/pursue-segments.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway.app

1. Go to https://railway.app → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo** → Select `pursue-segments`
3. **Before deploying**, add these Environment Variables:

   | Variable | Value |
   |----------|-------|
   | `GEMINI_API_KEY` | `your_key_from_ai_studio` |
   | `FLASK_ENV` | `production` |
   | `CORS_ORIGINS` | `*` (temporarily) |

4. Go to **Settings**:
   - Root Directory: `backend`
   - Start Command: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`
5. Click **Deploy**
6. Copy your backend URL (e.g., `https://pursue.up.railway.app`)

---

## Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New Project** → Import `pursue-segments`
3. Configure:
   - Root Directory: `frontend` ⚠️ (important!)
4. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-railway-url.railway.app`
5. Click **Deploy**
6. Copy your frontend URL (e.g., `https://pursue.vercel.app`)

---

## Step 4: Update CORS (Final Step!)

Back in Railway dashboard:
1. Change `CORS_ORIGINS` to your Vercel URL: `https://pursue.vercel.app`
2. Redeploy (happens automatically)

---

## ✅ Test Your Deployment

Visit your Vercel URL. You should see:
- The Pursue Segments homepage
- Working questionnaire
- Successful profile generation

---

## 🔄 Future Updates

```bash
# Make your changes, then:
git add .
git commit -m "Your update"
git push origin main

# Both Vercel and Railway auto-deploy!
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "API Error" on frontend | Check `NEXT_PUBLIC_API_URL` in Vercel env vars |
| CORS errors | Update `CORS_ORIGINS` in Railway with exact Vercel URL |
| Backend won't start | Check `GEMINI_API_KEY` is set and valid |
| Build fails | Ensure Root Directory is set to `frontend` |

---

## 📋 Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] `GEMINI_API_KEY` added to Railway
- [ ] Backend deployed successfully
- [ ] Vercel project created
- [ ] `NEXT_PUBLIC_API_URL` added to Vercel
- [ ] Frontend deployed successfully
- [ ] CORS updated with production URL
- [ ] Tested live site

🎉 You're live!
