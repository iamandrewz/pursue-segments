# Chunked File Upload Implementation Guide

## Overview
This implementation provides chunked file uploads for handling 2GB+ files on Flask/React with resume capability.

## Files Created

### 1. Backend: `chunked_uploads.py`
- Flask blueprint with 5 API endpoints
- Handles 10MB chunks (configurable)
- Stores chunks in `data/chunked_uploads/`
- Reassembles on `/complete`

### 2. Frontend: `templates/chunked_upload.html`
- Complete standalone HTML/JS uploader
- Drag & drop interface
- Visual chunk progress tracker
- Resume capability with localStorage
- Concurrent chunk uploads (3 parallel)

## Integration

### Add to your existing `app.py`:

```python
# At top with other imports
from chunked_uploads import chunked_bp

# After CORS setup (around line 71)
app.register_blueprint(chunked_bp)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chunked/initiate` | POST | Start upload session |
| `/api/chunked/upload` | POST | Upload single chunk |
| `/api/chunked/status/<id>` | GET | Get upload progress |
| `/api/chunked/complete` | POST | Reassemble chunks |
| `/api/chunked/abort` | POST | Cancel upload |

## API Usage

### 1. Initiate Upload
```javascript
POST /api/chunked/initiate
{ "filename": "video.mp4", "fileSize": 2147483648, "chunkSize": 10485760 }
// Returns: { "uploadId": "uuid", "totalChunks": 215 }
```

### 2. Upload Chunks
```javascript
POST /api/chunked/upload
FormData: { "chunk": File, "uploadId": "uuid", "chunkIndex": 0 }
// Returns: { "progress": 0.5, "chunksUploaded": 1 }
```

### 3. Check Status
```javascript
GET /api/chunked/status/<uploadId>
// Returns: { "progress": 2.3, "chunksUploaded": 5, "totalChunks": 215 }
```

### 4. Complete Upload
```javascript
POST /api/chunked/complete
{ "uploadId": "uuid" }
// Returns: { "filePath": "...", "fileSize": 2147483648, "fileHash": "sha256..." }
```

## Frontend Integration (React)

```jsx
import { useState } from 'react';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

function ChunkedUploader() {
  const [progress, setProgress] = useState(0);
  
  const handleUpload = async (file) => {
    // 1. Initiate
    const init = await fetch('/api/chunked/initiate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename: file.name, fileSize: file.size })
    });
    const { uploadId, totalChunks } = await init.json();
    
    // 2. Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await fetch('/api/chunked/upload', {
        method: 'POST',
        body: new FormData().append('chunk', chunk).append('uploadId', uploadId).append('chunkIndex', i)
      });
      setProgress(((i + 1) / totalChunks) * 100);
    }
    
    // 3. Complete
    await fetch('/api/chunked/complete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ uploadId })
    });
  };
  
  return <input type="file" onChange={e => handleUpload(e.target.files[0])} />;
}
```

## Configuration

### Adjust Chunk Size
In `chunked_uploads.py`:
```python
CHUNK_SIZE = 10 * 1024 * 1024  # 10MB - increase for faster uploads
```

### Render Deployment Considerations
- Render has 100MB request limit, but chunks are 10MB so it works
- Consider increasing chunk size to 25MB if needed
- Large files will take time - consider async processing

## Troubleshooting

1. **Upload fails mid-way**: Use `/api/chunked/status/<id>` to check progress, then resume from last chunk
2. **Memory issues**: Reduce `CHUNK_SIZE` to 5MB
3. **CORS errors**: Already handled in app.py CORS config
