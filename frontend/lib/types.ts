// Types for the questionnaire and profile system

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

export interface ProfileData {
  id: string;
  questionnaireId: string;
  podcastName: string;
  profile: string;
  wordCount: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
