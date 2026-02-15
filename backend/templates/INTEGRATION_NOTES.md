# Chunked File Upload Integration Notes

## Overview
Added chunked file upload support to handle files up to 5GB. Files >100MB automatically use chunked upload; smaller files use direct upload.

## Files Created/Modified

### 1. `chunked-uploader.js` (NEW)
- Vanilla JS module for chunked uploads
- Key features:
  - Splits files into 10MB chunks using `File.slice()`
  - Sequential chunk upload with retry logic (3 attempts)
  - Progress tracking (overall % and current chunk)
  - Resume capability via localStorage
  - Auto-detects and resumes previous uploads

- **Class: `ChunkedUploader`**
  ```javascript
  const uploader = new ChunkedUploader({
    chunkSize: 10 * 1024 * 1024,    // 10MB chunks
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB max
    autoResume: true,
    retryAttempts: 3,
    onProgress: (data) => {},
    onChunkComplete: (data) => {},
    onComplete: (data) => {},
    onError: (data) => {}
  });
  
  await uploader.initiate(file);
  await uploader.start();
  ```

- **Helper: `shouldUseChunkedUpload(file, threshold)`**
  - Returns true if file.size > threshold
  - Default threshold: 100MB

- **Helper: `createIntegratedUploader(options)`**
  - Convenience wrapper that auto-calls `/api/process-episode` after upload completes

### 2. `index.html` (UPDATED)
- Integrated chunked uploader with luxury dark theme
- Auto-detection: files >100MB use chunked mode
- UI changes:
  - Shows "CHUNKED" or "DIRECT" badge based on file size
  - Chunked progress shows: overall %, current chunk, speed, pause/cancel buttons
  - Resume notice when previous upload found
  - Seamless transition to analysis after upload completes

## Backend Endpoints (already exist)
- `POST /api/chunked/initiate` - Start upload session
- `POST /api/chunked/upload` - Upload single chunk
- `GET /api/chunked/status/<id>` - Check progress
- `POST /api/chunked/complete` - Reassemble file
- `POST /api/chunked/abort` - Cancel upload
- `POST /api/process-episode` - Process uploaded file (called after chunked complete)

## Integration Flow

### Chunked Upload Flow:
1. User selects file >100MB
2. UI shows "CHUNKED" mode badge
3. Click "Analyze Episode" → initiate() → start()
4. Chunks upload sequentially with progress
5. On complete → auto-calls /api/process-episode
6. Poll job status → display clips

### Resume Flow:
1. Page checks localStorage for saved upload
2. If found, shows "Resume" notice
3. On resume check, verifies with server status
4. Continues from last uploaded chunk

## Styling
- Matches existing luxury dark theme
- Purple/violet accents for chunked mode (#a855f7, #c084fc)
- Gradient progress bars
- Pulse animation on status dot

## Testing
Test with large files:
- <100MB: Should use direct upload
- >100MB: Should use chunked upload
- Interrupt and reload: Should offer resume
