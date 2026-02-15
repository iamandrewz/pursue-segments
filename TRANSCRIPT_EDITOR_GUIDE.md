# Transcript Editor Integration Guide

## Overview

The Transcript Editor is a visual component that allows users to fine-tune clip boundaries for AI-generated podcast clips. It provides drag-adjustable timestamps with sentence boundary snapping, real-time preview, and export functionality.

## Architecture

### Backend Endpoints

#### 1. GET /api/job/{jobId}/full-transcript
Returns the full transcript with timestamps and clip data for the editor.

**Response:**
```json
{
  "jobId": "uuid",
  "videoId": "string",
  "podcastName": "string",
  "duration": "MM:SS",
  "segments": [
    {
      "id": 0,
      "start": "MM:SS",
      "end": "MM:SS",
      "start_seconds": 0,
      "end_seconds": 30,
      "text": "Segment text...",
      "timestamp_text": "[MM:SS] Segment text..."
    }
  ],
  "clips": [
    {
      "start_timestamp": "MM:SS",
      "end_timestamp": "MM:SS",
      "duration_minutes": 10.5,
      "title_options": {...},
      "engaging_quote": "...",
      "transcript_excerpt": "...",
      "why_it_works": "..."
    }
  ],
  "fullText": "Complete transcript..."
}
```

#### 2. POST /api/job/{jobId}/save-clip
Saves adjusted clip timestamps.

**Request:**
```json
{
  "clipIndex": 0,
  "startTimestamp": "MM:SS or HH:MM:SS",
  "endTimestamp": "MM:SS or HH:MM:SS",
  "transcriptExcerpt": "Optional updated excerpt"
}
```

**Response:**
```json
{
  "success": true,
  "clipIndex": 0,
  "startTimestamp": "12:34",
  "endTimestamp": "22:45",
  "durationMinutes": 10.2,
  "message": "Clip saved successfully"
}
```

#### 3. GET /api/job/{jobId}/export-clips
Exports all clip data as JSON for download.

**Response:**
```json
{
  "jobId": "uuid",
  "videoId": "string",
  "podcastName": "string",
  "exportedAt": "ISO timestamp",
  "clips": [...]
}
```

### Frontend Components

#### 1. TranscriptEditor (components/TranscriptEditor.tsx)
Main editor component with:
- Timeline with draggable handles
- Sentence boundary snapping
- Real-time clip preview with word/character count
- Clip selection tabs
- Save and export functionality

#### 2. Editor Page (app/editor/[jobId]/page.tsx)
Next.js page wrapper for the editor component.

## Features

### Component 1: Transcript Viewer with Drag Handles
- Full transcript display with timestamps ([MM:SS] format)
- Visual highlight of clip boundaries (purple/royal blue theme)
- Draggable start/end handles on timeline
- Real-time timestamp display updates
- Snap to sentence boundaries (". ", "? ", "! ")

### Component 2: Clip Preview
- Live extracted text based on current boundaries
- Word count and character count
- Estimated duration display
- Click-to-select segments from full transcript

### Component 3: Save & Export
- Save adjusted timestamps to backend
- Export all clips as JSON
- Success/error feedback messages

## Usage

### Accessing the Editor

From the Results page, each clip card now has an "Edit Timestamps" button:

```tsx
<Link
  href={`/editor/${jobId}`}
  className="flex items-center justify-center space-x-2 px-4 py-3 bg-royal-600/30..."
>
  <Edit3 className="w-5 h-5" />
  <span>Edit Timestamps</span>
</Link>
```

### API Integration

```typescript
import { getFullTranscript, saveClip, exportClips } from '@/lib/api';

// Load transcript data
const data = await getFullTranscript(jobId);

// Save adjusted clip
await saveClip({
  jobId: jobId,
  clipIndex: 0,
  startTimestamp: "12:34",
  endTimestamp: "22:45",
});

// Export all clips
const exportData = await exportClips(jobId);
```

## Design

### Dark Theme with Purple/Blue Accents
- Background: `from-royal-950 to-royal-900`
- Accent: Royal blue (`royal-500`, `royal-600`)
- Clip highlight: `bg-royal-500/30`
- Handles: `bg-royal-500` with white grip indicator

### Typography
- Timestamps: Monospace font
- Body: Default sans-serif
- Interactive elements: Medium to semibold weights

## File Structure

```
frontend/
├── app/
│   ├── editor/
│   │   └── [jobId]/
│   │       └── page.tsx      # Editor page route
│   └── results/
│       └── [jobId]/
│           └── page.tsx      # Results with Edit button
├── components/
│   └── TranscriptEditor.tsx  # Main editor component
└── lib/
    └── api.ts                # API functions
```

## Testing

### Manual Testing
1. Process a YouTube video to generate clips
2. Navigate to Results page
3. Click "Edit Timestamps" on any clip
4. Drag timeline handles to adjust
5. Verify clip preview updates
6. Click Save Clip
7. Verify data persists

### API Testing
```bash
# Get full transcript
curl https://your-api.com/api/job/{jobId}/full-transcript

# Save clip
curl -X POST https://your-api.com/api/job/{jobId}/save-clip \
  -H "Content-Type: application/json" \
  -d '{"clipIndex": 0, "startTimestamp": "12:34", "endTimestamp": "22:45"}'

# Export clips
curl https://your-api.com/api/job/{jobId}/export-clips
```

## Future Enhancements

- Video preview integration
- Audio playback with seek
- Undo/redo functionality
- Batch clip adjustments
- Keyboard shortcuts (arrow keys for fine-tuning)
