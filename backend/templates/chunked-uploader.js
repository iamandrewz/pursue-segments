/**
 * Chunked File Upload Module
 * Handles large file uploads (up to 5GB) by splitting into 10MB chunks
 * Supports resume capability and automatic retry logic
 */

class ChunkedUploader {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || (10 * 1024 * 1024); // 10MB default
        this.maxFileSize = options.maxFileSize || (5 * 1024 * 1024 * 1024); // 5GB default
        this.autoResume = options.autoResume !== false;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        
        // Callbacks
        this.onProgress = options.onProgress || (() => {});
        this.onChunkComplete = options.onChunkComplete || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
        
        // State
        this.uploadId = null;
        this.file = null;
        this.totalChunks = 0;
        this.uploadedChunks = new Set();
        this.isUploading = false;
        this.isPaused = false;
        
        // Load saved upload from localStorage
        this._loadSavedUpload();
    }
    
    /**
     * Validate file and initiate upload
     */
    async initiate(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        
        if (file.size > this.maxFileSize) {
            throw new Error(`File too large. Maximum size is ${this.formatSize(this.maxFileSize)}`);
        }
        
        this.file = file;
        this.totalChunks = Math.ceil(file.size / this.chunkSize);
        
        // Check for existing upload
        const savedUpload = this._getSavedUpload();
        if (savedUpload && savedUpload.filename === file.name && savedUpload.fileSize === file.size) {
            const status = await this.checkStatus(savedUpload.uploadId);
            if (status.status === 'in_progress' && this.autoResume) {
                console.log('Resuming previous upload:', savedUpload.uploadId);
                this.uploadId = savedUpload.uploadId;
                this.uploadedChunks = new Set(status.uploadedChunks || []);
                this.resume();
                return;
            }
        }
        
        // Start new upload
        const response = await fetch('/api/chunked/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                fileSize: file.size,
                chunkSize: this.chunkSize
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to initiate upload');
        }
        
        const data = await response.json();
        this.uploadId = data.uploadId;
        this.uploadedChunks = new Set();
        
        // Save to localStorage for resume
        this._saveUpload();
        
        return data;
    }
    
    /**
     * Start or resume uploading chunks
     */
    async start() {
        if (!this.uploadId || !this.file) {
            throw new Error('No active upload. Call initiate() first.');
        }
        
        this.isUploading = true;
        this.isPaused = false;
        
        const startChunk = this.uploadedChunks.size;
        
        for (let i = startChunk; i < this.totalChunks; i++) {
            if (!this.isUploading || this.isPaused) break;
            
            // Skip already uploaded chunks
            if (this.uploadedChunks.has(i)) continue;
            
            await this._uploadChunk(i);
        }
        
        if (this.uploadedChunks.size === this.totalChunks) {
            await this._completeUpload();
        }
    }
    
    /**
     * Pause the upload
     */
    pause() {
        this.isPaused = true;
        console.log('Upload paused at chunk', this.uploadedChunks.size);
    }
    
    /**
     * Resume the upload
     */
    resume() {
        this.isPaused = false;
        this.start();
    }
    
    /**
     * Upload a single chunk with retry logic
     */
    async _uploadChunk(chunkIndex) {
        const start = chunkIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        const chunk = this.file.slice(start, end);
        
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('uploadId', this.uploadId);
                formData.append('chunkIndex', chunkIndex);
                
                const response = await fetch('/api/chunked/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Chunk upload failed');
                }
                
                const data = await response.json();
                this.uploadedChunks.add(chunkIndex);
                this._saveUpload();
                
                // Calculate and report progress
                const progress = (this.uploadedChunks.size / this.totalChunks) * 100;
                this.onProgress({
                    chunkIndex,
                    totalChunks: this.totalChunks,
                    uploadedChunks: this.uploadedChunks.size,
                    progress: progress,
                    bytesUploaded: this.uploadedChunks.size * this.chunkSize,
                    totalBytes: this.file.size
                });
                
                this.onChunkComplete({ chunkIndex, response: data });
                return;
                
            } catch (err) {
                console.warn(`Chunk ${chunkIndex} attempt ${attempt + 1} failed:`, err.message);
                if (attempt < this.retryAttempts - 1) {
                    await this._delay(this.retryDelay * (attempt + 1));
                } else {
                    this.onError({ chunkIndex, error: err.message });
                    throw err;
                }
            }
        }
    }
    
    /**
     * Complete the upload and reassemble file
     */
    async _completeUpload() {
        const response = await fetch('/api/chunked/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId: this.uploadId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to complete upload');
        }
        
        const data = await response.json();
        
        // Clear saved upload
        this._clearSavedUpload();
        
        this.onComplete({
            filePath: data.filePath,
            filename: data.filename,
            fileSize: data.fileSize,
            fileHash: data.fileHash
        });
        
        return data;
    }
    
    /**
     * Check upload status
     */
    async checkStatus(uploadId) {
        const id = uploadId || this.uploadId;
        if (!id) throw new Error('No upload ID');
        
        const response = await fetch(`/api/chunked/status/${id}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to check status');
        }
        
        return await response.json();
    }
    
    /**
     * Abort/cancel the upload
     */
    async abort() {
        if (!this.uploadId) return;
        
        try {
            await fetch('/api/chunked/abort', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId: this.uploadId })
            });
        } catch (err) {
            console.warn('Failed to abort on server:', err);
        }
        
        this.isUploading = false;
        this.uploadId = null;
        this.uploadedChunks.clear();
        this._clearSavedUpload();
    }
    
    /**
     * Get current progress info
     */
    getProgress() {
        if (!this.file) return null;
        
        return {
            uploadId: this.uploadId,
            file: this.file.name,
            fileSize: this.file.size,
            totalChunks: this.totalChunks,
            uploadedChunks: this.uploadedChunks.size,
            progress: (this.uploadedChunks.size / this.totalChunks) * 100,
            isUploading: this.isUploading,
            isPaused: this.isPaused
        };
    }
    
    /**
     * Process the uploaded file (call /api/process-episode)
     */
    async processEpisode(filePath) {
        const response = await fetch('/api/process-episode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to process episode');
        }
        
        return await response.json();
    }
    
    // ========== LocalStorage Helpers ==========
    
    _saveUpload() {
        if (!this.uploadId || !this.file) return;
        
        const saveData = {
            uploadId: this.uploadId,
            filename: this.file.name,
            fileSize: this.file.size,
            chunkSize: this.chunkSize,
            uploadedChunks: Array.from(this.uploadedChunks),
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('chunkedUpload', JSON.stringify(saveData));
        } catch (err) {
            console.warn('Failed to save upload state:', err);
        }
    }
    
    _getSavedUpload() {
        try {
            const saved = localStorage.getItem('chunkedUpload');
            if (!saved) return null;
            
            const data = JSON.parse(saved);
            
            // Clear if older than 24 hours
            if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                this._clearSavedUpload();
                return null;
            }
            
            return data;
        } catch (err) {
            return null;
        }
    }
    
    _loadSavedUpload() {
        const saved = this._getSavedUpload();
        if (saved) {
            this.uploadId = saved.uploadId;
            this.chunkSize = saved.chunkSize;
            this.uploadedChunks = new Set(saved.uploadedChunks || []);
        }
    }
    
    _clearSavedUpload() {
        try {
            localStorage.removeItem('chunkedUpload');
        } catch (err) {
            console.warn('Failed to clear upload state:', err);
        }
    }
    
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Convenience function for detecting if file needs chunked upload
 */
function shouldUseChunkedUpload(file, threshold = 100 * 1024 * 1024) {
    return file.size > threshold;
}

/**
 * Create uploader with integrated process-episode call
 */
function createIntegratedUploader(options = {}) {
    const {
        onProgress = () => {},
        onChunkComplete = () => {},
        onComplete = () => {},
        onError = () => {},
        onProcessingStart = () => {},
        onProcessingComplete = () => {},
        onProcessingError = () => {}
    } = options;
    
    const uploader = new ChunkedUploader({
        ...options,
        onProgress,
        onChunkComplete,
        onError,
        onComplete: async (result) => {
            // After upload completes, trigger processing
            onProcessingStart(result);
            
            try {
                const processResult = await uploader.processEpisode(result.filePath);
                onProcessingComplete(processResult);
                onComplete({ ...result, ...processResult });
            } catch (err) {
                onProcessingError(err);
                onError(err);
            }
        }
    });
    
    return uploader;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChunkedUploader, shouldUseChunkedUpload, createIntegratedUploader };
}
