# Pursue Segments - Podcast Long-Form Clip Generator

AI-powered podcast clip generator that analyzes YouTube episodes and suggests engaging 8-20 minute segments optimized for your target audience.

## Features

- **32-Question Onboarding**: Deep dive into your podcast audience
- **AI Profile Generation**: Gemini 2.0 Flash creates detailed target audience profiles
- **YouTube Processing**: Download, transcribe, and analyze episodes automatically
- **Smart Clip Detection**: AI finds engaging segments with hooks, story arcs, and emotional moments
- **Title Generation**: Get 3 title options per clip (punchy, benefit-driven, curiosity-inducing)

## Tech Stack

- **Backend**: Python Flask, yt-dlp, OpenAI Whisper, Gemini 2.0 Flash
- **Frontend**: Next.js 15, React, Tailwind CSS, TypeScript
- **Hosting**: Railway (backend), Vercel (frontend)

## API Endpoints

### Health & Status

```
GET /api/health
```
Returns service health status and API configurations.

### Questionnaire

```
POST /api/questionnaire
```
Save questionnaire answers.
**Body**: `{ podcastName, hostNames, answers }`

```
GET /api/questionnaire/<questionnaire_id>
```
Retrieve questionnaire by ID.

### Profile Generation

```
POST /api/generate-profile
```
Generate target audience profile using Gemini.
**Body**: `{ questionnaireId }`

```
GET /api/profile/<profile_id>
```
Retrieve generated profile.

### YouTube Processing

```
POST /api/process-episode
```
Start processing a YouTube episode.
**Body**: 
```json
{
  "youtubeUrl": "https://youtube.com/watch?v=...",
  "podcastName": "My Podcast",
  "profileId": "optional-profile-id",
  "userId": "optional-user-id"
}
```
**Response**:
```json
{
  "jobId": "uuid",
  "status": "queued",
  "message": "Episode processing started"
}
```

```
GET /api/job/<job_id>
```
Get job status and results.
**Response**:
```json
{
  "jobId": "uuid",
  "status": "complete",
  "progressMessage": "Analysis complete!",
  "podcastName": "My Podcast",
  "transcript": { ... },
  "clips": [ ... ],
  "clipCount": 5
}
```

```
POST /api/analyze-clips
```
Analyze clips from a transcript (can be called separately).
**Body**: `{ jobId, targetAudienceProfile? }`

```
GET /api/transcript/<video_id>
```
Get cached transcript for a video.

## Environment Variables

### Backend (.env)

```
FLASK_PORT=5001
CORS_ORIGINS=http://localhost:3000,https://segments.pursuepodcasting.com
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Processing Pipeline

1. **Download**: yt-dlp extracts audio from YouTube video
2. **Transcribe**: OpenAI Whisper converts audio to timestamped text
3. **Analyze**: Gemini 2.0 Flash identifies engaging 8-20 minute segments
4. **Results**: Returns clips with titles, timestamps, quotes, and excerpts

## Job Statuses

- `queued` - Waiting to start
- `downloading` - Downloading audio from YouTube
- `transcribing` - Converting audio to text
- `analyzing` - AI analyzing segments
- `complete` - Analysis finished
- `failed` - Error occurred

## Cost Per Episode

- yt-dlp download: Free
- Whisper transcription: ~$0.18 (30-min episode)
- Gemini analysis: ~$0.005
- **Total: ~$0.185 per episode**

## Deployment

### Backend (Railway)

1. Connect GitHub repo to Railway
2. Set Root Directory = `backend`
3. Add environment variables
4. Deploy

### Frontend (Vercel)

1. Connect GitHub repo to Vercel
2. Set Root Directory = `frontend`
3. Add environment variables
4. Deploy

## Testing

Test with any YouTube URL:
```bash
curl -X POST http://localhost:5001/api/process-episode \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "podcastName": "Test Podcast"
  }'
```

Then poll for results:
```bash
curl http://localhost:5001/api/job/<job_id>
```

## Project Structure

```
pursue-segments/
├── backend/
│   ├── app.py              # Flask API
│   ├── requirements.txt    # Python dependencies
│   └── data/               # Data storage (JSON files)
│       ├── jobs/           # Job status files
│       └── transcripts/    # Cached transcripts
├── frontend/
│   ├── app/                # Next.js pages
│   │   ├── dashboard/      # Dashboard with upload
│   │   ├── processing/     # Progress page
│   │   ├── results/        # Clip results page
│   │   └── questionnaire/  # Onboarding form
│   ├── lib/
│   │   ├── api.ts          # API functions
│   │   └── types.ts        # TypeScript types
│   └── components/         # React components
└── README.md
```

## Future Features

- [ ] Hardware-accelerated clip encoding (Mac Mini M4)
- [ ] User accounts & authentication (Supabase)
- [ ] Subscription plans & payments (Stripe)
- [ ] Auto-post to YouTube
- [ ] Thumbnail generation
- [ ] Analytics dashboard

## License

Private - Pursue Podcasting
