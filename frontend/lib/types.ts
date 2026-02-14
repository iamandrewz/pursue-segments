// Types for Pursue Segments application

// ============================================================================
// QUESTIONNAIRE TYPES
// ============================================================================

export interface Question {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'radio';
  label: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  helpText?: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface QuestionnaireAnswers {
  [key: string]: string | string[];
}

export interface QuestionnaireData {
  id?: string;
  podcastName: string;
  hostNames: string;
  answers: QuestionnaireAnswers;
  createdAt?: string;
  status?: string;
  profileId?: string;
}

// ============================================================================
// PROFILE TYPES
// ============================================================================

export interface ProfileData {
  id: string;
  questionnaireId: string;
  podcastName: string;
  profile: string;
  wordCount: number;
  createdAt: string;
}

// ============================================================================
// YOUTUBE PROCESSING TYPES
// ============================================================================

export interface ProcessEpisodeRequest {
  youtubeUrl: string;
  podcastName: string;
  profileId?: string;
  userId?: string;
}

export interface ProcessEpisodeResponse {
  jobId: string;
  status: string;
  message: string;
}

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

export type JobStatus = 'queued' | 'downloading' | 'transcribing' | 'analyzing' | 'complete' | 'failed';

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progressMessage: string;
  podcastName: string;
  createdAt: string;
  updatedAt: string;
  transcript?: TranscriptData;
  clips?: ClipSuggestion[];
  clipCount?: number;
  error?: string;
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

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
