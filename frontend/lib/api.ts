const API_URL = 'https://pursue-segments-backend.onrender.com';

// ============================================================================
// QUESTIONNAIRE API
// ============================================================================

export async function saveQuestionnaire(data: {
  podcastName: string;
  hostNames: string;
  answers: Record<string, string>;
}) {
  const response = await fetch(`${API_URL}/api/questionnaire`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save questionnaire');
  }

  return response.json();
}

export async function getQuestionnaire(id: string) {
  const response = await fetch(`${API_URL}/api/questionnaire/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch questionnaire');
  }

  return response.json();
}

// ============================================================================
// PROFILE API
// ============================================================================

export async function generateProfile(questionnaireId: string) {
  try {
    const response = await fetch(`${API_URL}/api/generate-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionnaireId }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate profile';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    // Network/fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to the server. Please check your internet connection.');
    }
    throw error;
  }
}

export async function getProfile(id: string) {
  const response = await fetch(`${API_URL}/api/profile/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch profile');
  }

  return response.json();
}

// ============================================================================
// FILE UPLOAD / EPISODE PROCESSING API
// ============================================================================

export interface ProcessEpisodeFileRequest {
  file: File;
  podcastName: string;
  profileId?: string;
  userId?: string;
}

export interface ProcessEpisodeResponse {
  jobId: string;
  status: string;
  message: string;
}

export async function processEpisodeWithFile(data: ProcessEpisodeFileRequest): Promise<ProcessEpisodeResponse> {
  const formData = new FormData();
  formData.append('video', data.file);
  formData.append('podcastName', data.podcastName);
  
  if (data.profileId) {
    formData.append('profileId', data.profileId);
  }
  
  if (data.userId) {
    formData.append('userId', data.userId);
  }

  const response = await fetch(`${API_URL}/api/process-episode`, {
    method: 'POST',
    body: formData,
    // Note: Do NOT set Content-Type header - browser will set it with boundary
  });

  if (!response.ok) {
    let errorMessage = 'Failed to start episode processing';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================================
// JOB STATUS API
// ============================================================================

export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'failed';
  progressMessage: string;
  podcastName: string;
  createdAt: string;
  updatedAt: string;
  transcript?: TranscriptData;
  clips?: ClipSuggestion[];
  clipCount?: number;
  error?: string;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_URL}/api/job/${jobId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch job status');
  }

  return response.json();
}

export interface AnalyzeClipsRequest {
  jobId: string;
  targetAudienceProfile?: string;
}

export interface AnalyzeClipsResponse {
  clips: ClipSuggestion[];
  clipCount: number;
  status: string;
}

export async function analyzeClips(data: AnalyzeClipsRequest): Promise<AnalyzeClipsResponse> {
  const response = await fetch(`${API_URL}/api/analyze-clips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze clips');
  }

  return response.json();
}

export async function getTranscript(videoId: string): Promise<TranscriptData> {
  const response = await fetch(`${API_URL}/api/transcript/${videoId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch transcript');
  }

  return response.json();
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkHealth() {
  const response = await fetch(`${API_URL}/api/health`);
  return response.json();
}

// ============================================================================
// TYPES (imported in types.ts)
// ============================================================================

export interface TranscriptSegment {
  start: string;
  end: string;
  text: string;
  start_seconds: number;
  end_seconds: number;
}

export interface TranscriptData {
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
  duration: string;
  createdAt: string;
}

export interface TitleOptions {
  punchy: string;
  benefit: string;
  curiosity: string;
}

export interface ClipSuggestion {
  start_timestamp: string;
  end_timestamp: string;
  duration_minutes: number;
  title_options: TitleOptions;
  engaging_quote: string;
  transcript_excerpt: string;
  why_it_works: string;
}
