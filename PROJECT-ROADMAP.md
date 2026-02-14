# Pursue Segments - Project Roadmap

**Last Updated:** 2026-02-13 21:38 PST  
**Status:** Foundation Complete, YouTube Processing Next

---

## ✅ COMPLETED (Tonight - 2/13/26)

### Infrastructure
- [x] GitHub repo created: `iamandrewz/pursue-segments`
- [x] Backend deployed to Railway: `https://pursue-segments-production.up.railway.app`
- [x] Frontend deployed to Vercel: `https://segments.pursuepodcasting.com`
- [x] Custom domain connected and live
- [x] Environment variables configured (Gemini API key, CORS, etc.)

### Features Built
- [x] 32-question onboarding questionnaire (7 sections)
- [x] Gemini 2.0 Flash integration for target audience generation
- [x] Dashboard showing generated profile
- [x] Dark royal blue brand theme matching Pursue Podcasting
- [x] Mobile-responsive design
- [x] Copy/download profile functionality

### Costs
- Backend hosting: $0 (Railway free tier - 30 days or $5.00 left)
- Frontend hosting: $0 (Vercel free tier)
- API calls tonight: ~$0.50 (Gemini free tier)
- Total: **$0.50**

---

## 🎯 PHASE 2: YouTube Processing Pipeline (NEXT)

### Goal
User pastes YouTube link → App downloads, transcribes, analyzes → Returns 3-5 long-form clip suggestions with timestamps + titles

### Tasks

#### 1. Backend Processing Engine
- [ ] YouTube download endpoint (`POST /api/process-episode`)
  - Accept YouTube URL + podcast name from frontend
  - Use `yt-dlp` to download video to temp storage
  - Return job ID for progress tracking
- [ ] Whisper transcription integration
  - Use OpenAI Whisper API (already have key)
  - Cost: ~$0.18 per 30-min episode
  - Return timestamped transcript
- [ ] Gemini clip analysis
  - Feed transcript + target audience profile into Gemini
  - Prompt: Find 3-5 engaging 8-20 minute segments
  - Return: Start/end timestamps, 3 title options each, transcript excerpt
- [ ] Temp file cleanup (auto-delete after processing)
- [ ] Progress tracking API (`GET /api/job/:id`)

**Estimated Time:** 4-6 hours  
**Cost per Episode:** ~$0.23 (Whisper $0.18 + Gemini $0.05)

#### 2. Frontend Upload Flow
- [ ] YouTube link input page (replace "Upload Episode" placeholder button)
- [ ] Progress indicator while processing:
  - Downloading video...
  - Transcribing audio...
  - Analyzing segments...
  - Done!
- [ ] Results page showing:
  - 3-5 clip cards
  - Each with: 3 title options, start/end times, most engaging quote
  - Transcript viewer with highlighted sections
- [ ] "Generate Clip" button for each segment

**Estimated Time:** 3-4 hours

#### 3. Transcript Editor
- [ ] Full transcript display with timestamps
- [ ] Click/drag to adjust clip start/end times
- [ ] Visual indicator showing selected segment
- [ ] "Are you sure?" confirmation before encoding (uses monthly credit)
- [ ] Inspired by Riverside.fm text-based editor

**Estimated Time:** 4-5 hours  
**Tech:** React state management, timestamp calculation, visual highlighting

#### 4. Clip Encoding (Mac Mini Integration)
- [ ] FFmpeg encoding endpoint on Mac Mini M4 (when it arrives Thu 2/20)
- [ ] SSH connection from Railway backend to Mac Mini
- [ ] Encode command: `ffmpeg -i input.mp4 -ss START -to END -c:v h264_videotoolbox -b:v 5M -c:a aac output.mp4`
- [ ] Hardware acceleration = ~30 second encode per clip
- [ ] Upload encoded clip to S3/Cloudflare R2 (7-day retention)
- [ ] Return download URL to frontend

**Estimated Time:** 3-4 hours (requires Mac Mini setup)  
**Cost per Clip:** ~$0.05 storage for 7 days

---

## 🚀 PHASE 3: User Accounts & Payments (AFTER PHASE 2)

### Goal
Users can sign up, subscribe, track usage, download clips

### Tasks

#### 1. Authentication
- [ ] Supabase Auth integration (free tier: 50k users)
- [ ] Sign up / Login pages
- [ ] Password reset flow
- [ ] Session management

**Estimated Time:** 2-3 hours

#### 2. Database Schema
- [ ] Users table (email, password_hash, subscription_tier, credits_remaining)
- [ ] Episodes table (user_id, youtube_url, target_audience_profile, status, created_at)
- [ ] Clips table (episode_id, start_time, end_time, title, download_url, expires_at)
- [ ] Use Supabase PostgreSQL (free tier: 500MB)

**Estimated Time:** 2 hours

#### 3. Stripe Integration
- [ ] Product setup in Stripe dashboard
  - Starter: $19/mo, 10 clips
  - Pro: $49/mo, 30 clips
  - Enterprise: $99/mo, unlimited clips
- [ ] Checkout flow
- [ ] Webhook handler for subscription events
- [ ] Usage tracking (decrement credits on clip generation)

**Estimated Time:** 3-4 hours  
**Stripe Fee:** 2.9% + $0.30 per transaction

#### 4. User Dashboard
- [ ] Profile page (email, subscription tier, credits remaining)
- [ ] Episode history (past uploads, clip status)
- [ ] Download center (7-day expiration countdown)
- [ ] Email notifications (24/48hr before clip expiration)

**Estimated Time:** 4-5 hours

---

## 📊 PHASE 4: Testing & Refinement

### Internal Testing (Your Team)
- [ ] Reagan tests with SPP episodes
- [ ] Josh/Caleb test with various podcast lengths
- [ ] Ejohn/Rian test clip quality vs their manual edits
- [ ] Collect feedback on accuracy, usability, speed

**Goal:** 10 successful episodes processed without errors  
**Timeline:** 1 week

### Improvements Based on Testing
- [ ] Adjust Gemini prompts for better clip selection
- [ ] Tune timestamp accuracy (±5 seconds acceptable per Andrew 2/13)
- [ ] Add "Regenerate Clips" option (max 3x per episode)
- [ ] Improve transcript readability (formatting, speaker detection)

**Estimated Time:** 2-3 hours per iteration

---

## 🎉 PHASE 5: Public Launch

### Pre-Launch Checklist
- [ ] Terms of Service page
- [ ] Privacy Policy page
- [ ] FAQ / Help documentation
- [ ] Pricing page with feature comparison
- [ ] Intro video (Andrew records walkthrough)
- [ ] Sample episode demo (show before/after)
- [ ] Error handling (what if YouTube link fails, transcription fails, etc.)
- [ ] Rate limiting (prevent abuse of free tier)

### Launch Strategy
- [ ] Soft launch to Andrew's email list (500-1000 podcasters)
- [ ] JPI episode announcement (Fitness Authority Academy tie-in)
- [ ] X/Twitter thread showcasing clips
- [ ] Testimonials from Reagan/team

### Success Metrics (First 30 Days)
- 50 signups
- 10 paying subscribers ($290 MRR minimum)
- 90%+ clip approval rate (users accept clips without regenerating)
- <5% churn

---

## 🛠️ TECHNICAL REQUIREMENTS

### APIs & Services
| Service | Purpose | Cost |
|---------|---------|------|
| Railway | Backend hosting | $5/mo after free tier |
| Vercel | Frontend hosting | Free (pro: $20/mo if needed) |
| Gemini 2.0 Flash | Clip analysis | ~$0.005/episode |
| OpenAI Whisper | Transcription | ~$0.18/episode |
| Supabase | Auth + Database | Free tier (500MB) |
| Stripe | Payments | 2.9% + $0.30/transaction |
| Cloudflare R2 | Clip storage | $0.015/GB/month |
| Mac Mini M4 | Encoding | One-time $599 (owned) |

**Estimated Monthly Cost @ 100 Episodes/Month:**
- Processing: $23 (Whisper + Gemini)
- Hosting: $5 (Railway)
- Storage: $2 (R2, 7-day retention)
- **Total: ~$30/month**

**Revenue @ 10 Paying Users:**
- $290/month (assuming $29/mo average)
- **Profit: $260/month**

### Development Tools
- **Backend:** Python 3.14, Flask, yt-dlp, ffmpeg
- **Frontend:** Next.js 15, React, Tailwind CSS, TypeScript
- **Database:** PostgreSQL (Supabase)
- **Version Control:** GitHub
- **CI/CD:** Vercel auto-deploy (frontend), Railway auto-deploy (backend)

---

## 📝 IMMEDIATE NEXT STEPS (Tomorrow / This Week)

### Priority 1: YouTube Processing (Backend)
**Goal:** Download + transcribe + analyze working end-to-end

1. Kimi builds `/api/process-episode` endpoint
   - Accept YouTube URL
   - Download via yt-dlp
   - Transcribe via Whisper API
   - Return job ID
2. Test with one SPP episode
3. Kimi builds `/api/analyze-clips` endpoint
   - Feed transcript + target audience to Gemini
   - Return 3-5 clips with timestamps + titles
4. Test clip suggestions for accuracy

**Estimated Time:** 4-6 hours  
**Owner:** Kimi (Sonnet coordinates)

### Priority 2: Frontend Upload Flow
**Goal:** User can paste YouTube link and see results

1. Kimi builds upload page (replace "Upload Episode" button)
2. Add progress indicator (polling `/api/job/:id`)
3. Display results page with clip cards
4. Test full flow: questionnaire → YouTube upload → see clips

**Estimated Time:** 3-4 hours  
**Owner:** Kimi (Sonnet coordinates)

### Priority 3: Implement Andrew's Feedback
**Goal:** Polish the questionnaire/dashboard based on tonight's notes

1. Andrew sends feedback via Telegram
2. Sonnet prioritizes changes
3. Kimi implements
4. Deploy and test

**Estimated Time:** 1-2 hours  
**Owner:** Kimi (feedback-driven)

---

## 💡 FUTURE IDEAS (Backlog)

- **Auto-post clips to YouTube** (OAuth integration)
- **Thumbnail generation** (AI-powered with brand colors)
- **Multi-language support** (Whisper supports 50+ languages)
- **Team accounts** (multiple users, shared credits)
- **API access for agencies** ($199/mo tier)
- **Analytics dashboard** (views, engagement tracking)
- **Mobile app** (React Native, download/manage clips on phone)

---

## 🔥 KEY LESSONS LEARNED (2/13/26)

1. **Sonnet drives, Haiku/Kimi execute** - Model hierarchy prevents dropped handoffs
2. **Railway needs Root Directory = backend** - Otherwise it can't find the code
3. **Vercel needs Root Directory = frontend** - Same issue
4. **Next.js 15 requires Suspense for useSearchParams()** - Caught in deployment
5. **DNS propagation can be instant** - NameCheap is fast
6. **Gemini 2.0 Flash crushes GPT-4o-mini** - Cheaper, faster, better output
7. **Always push to GitHub to trigger deploys** - Manual redeploy buttons are flakey
8. **Build, test, iterate fast** - We went live in 3 hours because we didn't overthink

---

## 📞 SUPPORT & DOCS

- **Backend Repo:** https://github.com/iamandrewz/pursue-segments
- **Live App:** https://segments.pursuepodcasting.com
- **Railway Dashboard:** https://railway.app
- **Vercel Dashboard:** https://vercel.com
- **Gemini API Console:** https://aistudio.google.com/apikey
- **OpenAI API Keys:** https://platform.openai.com/api-keys
- **Deployment Guide:** See `/DEPLOYMENT.md` in repo

---

**Status:** Foundation complete. YouTube processing is next. Let's fucking go. 🚀
