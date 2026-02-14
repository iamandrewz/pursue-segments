'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  Upload, 
  FileText, 
  Loader2, 
  Download, 
  Share2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
  History,
  Zap,
  Target,
  Film,
  Video,
  X,
  FileVideo
} from 'lucide-react';
import { getProfile, processEpisodeWithFile, getJobStatus } from '@/lib/api';
import { ProfileData, JobStatusResponse } from '@/lib/types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/webm',
];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isValidVideoFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds 500MB limit. Your file is ${formatFileSize(file.size)}.` 
    };
  }

  // Check MIME type
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { valid: true };
  }

  // Check file extension as fallback
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_VIDEO_EXTENSIONS.some(ext => fileName.endsWith(ext));
  
  if (hasValidExtension) {
    return { valid: true };
  }

  return { 
    valid: false, 
    error: 'Invalid file type. Please upload a video file (.mp4, .mov, .avi, .mkv, .webm).' 
  };
}

// ============================================================================
// RECENT EPISODES COMPONENT
// ============================================================================

interface RecentEpisode {
  jobId: string;
  podcastName: string;
  videoId?: string;
  fileName?: string;
  status: string;
  createdAt: string;
  clipCount?: number;
}

function RecentEpisodes({ onSelect }: { onSelect: (file: File) => void }) {
  const [episodes, setEpisodes] = useState<RecentEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load recent jobs from localStorage
    const loadRecentEpisodes = () => {
      try {
        const stored = localStorage.getItem('recentEpisodes');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Sort by date, most recent first
          parsed.sort((a: RecentEpisode, b: RecentEpisode) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setEpisodes(parsed.slice(0, 5)); // Show last 5
        }
      } catch (e) {
        console.error('Failed to load recent episodes:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentEpisodes();
  }, []);

  const handleViewResults = (jobId: string) => {
    router.push(`/results/${jobId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-royal-400 animate-spin" />
      </div>
    );
  }

  if (episodes.length === 0) {
    return null;
  }

  return (
    <div className="mt-10">
      <div className="flex items-center space-x-2 mb-4">
        <History className="w-5 h-5 text-royal-400" />
        <h3 className="text-lg font-semibold text-white">Recent Episodes</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {episodes.map((episode) => (
          <div 
            key={episode.jobId}
            className="group p-4 rounded-xl bg-white/5 border border-white/10 hover:border-royal-500/30 transition-all cursor-pointer"
            onClick={() => handleViewResults(episode.jobId)}
          >
            <div className="flex items-start space-x-3">
              <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-royal-900 flex items-center justify-center">
                <FileVideo className="w-8 h-8 text-royal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{episode.podcastName}</p>
                {episode.fileName && (
                  <p className="text-sm text-gray-400 truncate">{episode.fileName}</p>
                )}
                <p className="text-sm text-gray-400">
                  {new Date(episode.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
                {episode.status === 'complete' && episode.clipCount && (
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium text-green-400 bg-green-400/10 rounded-full">
                    {episode.clipCount} segments
                  </span>
                )}
                {episode.status === 'failed' && (
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium text-red-400 bg-red-400/10 rounded-full">
                    Failed
                  </span>
                )}
                {episode.status !== 'complete' && episode.status !== 'failed' && (
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium text-yellow-400 bg-yellow-400/10 rounded-full">
                    Refining
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HOW IT WORKS COMPONENT
// ============================================================================

function HowItWorks() {
  const steps = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: "Upload Your Episode",
      description: "Select a video file from your computer. We support MP4, MOV, AVI, MKV, and WEBM formats up to 500MB.",
      color: "text-blue-400"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Intelligent Analysis",
      description: "Our system transcribes and analyzes your episode with precision (~3 minutes).",
      color: "text-purple-400"
    },
    {
      icon: <Film className="w-6 h-6" />,
      title: "Receive Curated Selections",
      description: "Discover 3-5 refined segment recommendations with titles and timestamps.",
      color: "text-green-400"
    }
  ];

  return (
    <div className="mt-10 p-6 rounded-xl bg-royal-900/20 border border-royal-700/20">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Zap className="w-5 h-5 mr-2 text-yellow-400" />
        The Experience
      </h3>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start space-x-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${step.color}`}>
              {step.icon}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-royal-400">Step {index + 1}</span>
                <h4 className="text-white font-medium">{step.title}</h4>
              </div>
              <p className="text-sm text-gray-400 mt-1">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FILE PREVIEW COMPONENT
// ============================================================================

interface FilePreviewProps {
  file: File;
  onClear: () => void;
}

function FilePreview({ file, onClear }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Create a temporary URL for the video file
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
      <div className="flex items-start space-x-4">
        <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-royal-900 flex items-center justify-center">
          {previewUrl ? (
            <video 
              src={previewUrl} 
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <FileVideo className="w-10 h-10 text-royal-400" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium line-clamp-1" title={file.name}>
            {file.name}
          </h4>
          <p className="text-sm text-gray-400 mt-1">{formatFileSize(file.size)}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-400 bg-green-400/10 rounded">
              <CheckCircle className="w-3 h-3 mr-1" />
              Valid Video
            </span>
            <button
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DRAG AND DROP UPLOAD COMPONENT
// ============================================================================

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

function FileUploadZone({ onFileSelect, selectedFile }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging 
          ? 'border-royal-500 bg-royal-500/10' 
          : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.mov,.avi,.mkv,.webm,video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="flex flex-col items-center space-y-3">
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center
          ${isDragging ? 'bg-royal-500/20' : 'bg-white/10'}
        `}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-royal-400' : 'text-gray-400'}`} />
        </div>
        
        <div>
          <p className="text-white font-medium">
            {isDragging ? 'Drop your video here' : 'Click or drag video to upload'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Supports MP4, MOV, AVI, MKV, WEBM up to 500MB
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD CONTENT
// ============================================================================

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams.get('profileId');
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [fileError, setFileError] = useState('');

  // TEMP: Bypass profile loading for testing
  useEffect(() => {
    if (profileId) {
      loadProfile();
    }
  }, [profileId]);

  const loadProfile = async () => {
    try {
      const data = await getProfile(profileId!);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyProfile = () => {
    if (profile?.profile) {
      navigator.clipboard.writeText(profile.profile);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadProfile = () => {
    if (profile?.profile) {
      const blob = new Blob([profile.profile], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.podcastName.replace(/\s+/g, '_')}_Target_Audience_Profile.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadError('');
    setFileError('');
    
    const validation = isValidVideoFile(file);
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileError('');
    setUploadError('');
  };

  const saveToRecentEpisodes = (jobData: { 
    jobId: string; 
    podcastName: string; 
    fileName: string; 
    status: string; 
    createdAt: string 
  }) => {
    try {
      const stored = localStorage.getItem('recentEpisodes');
      const episodes: RecentEpisode[] = stored ? JSON.parse(stored) : [];
      
      // Add new episode to beginning
      episodes.unshift({
        jobId: jobData.jobId,
        podcastName: jobData.podcastName,
        fileName: jobData.fileName,
        status: jobData.status,
        createdAt: jobData.createdAt
      });
      
      // Keep only last 10
      const trimmed = episodes.slice(0, 10);
      localStorage.setItem('recentEpisodes', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save recent episode:', e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setFileError('Please select a video file');
      return;
    }

    const validation = isValidVideoFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const response = await processEpisodeWithFile({
        file: selectedFile,
        podcastName: profile?.podcastName || 'My Podcast',
        profileId: profileId || undefined,
      });

      // Save to recent episodes
      saveToRecentEpisodes({
        jobId: response.jobId,
        podcastName: profile?.podcastName || 'My Podcast',
        fileName: selectedFile.name,
        status: 'queued',
        createdAt: new Date().toISOString()
      });

      // Redirect to processing page
      router.push(`/processing/${response.jobId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start processing';
      setUploadError(errorMsg);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-royal-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-royal-600 to-royal-800 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <span className="text-white font-semibold">Pursue Segments</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link 
                href="/questionnaire"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                New Consultation
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Refine Your Episode
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              Upload a video file and our intelligent system will identify the finest 8-20 minute segments 
              curated for your audience.
            </p>
          </div>

          {/* Submit Episode Form */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-royal-800/50 to-royal-900/50 border border-royal-700/30">
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Upload Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Video File
                </label>
                
                {!selectedFile ? (
                  <FileUploadZone 
                    onFileSelect={handleFileSelect} 
                    selectedFile={selectedFile}
                  />
                ) : (
                  <FilePreview 
                    file={selectedFile} 
                    onClear={handleClearFile}
                  />
                )}
                
                {/* Error Message */}
                {fileError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center animate-fadeIn">
                    <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    {fileError}
                  </p>
                )}
                
                {/* Hint Message */}
                {!fileError && !selectedFile && (
                  <p className="mt-2 text-sm text-gray-500">
                    Maximum file size: 500MB
                  </p>
                )}
              </div>

              {/* Upload Error */}
              {uploadError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3 animate-fadeIn">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Processing Failed</p>
                    <p className="text-red-300/80 text-sm mt-1">{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center text-sm text-gray-400">
                  <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Refinement takes 2-5 minutes</span>
                </div>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile || !!fileError}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-royal-600 hover:bg-royal-500 disabled:bg-royal-800/50 disabled:text-royal-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-base"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Refine Episode</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* How It Works */}
          <HowItWorks />

          {/* Recent Episodes */}
          <RecentEpisodes onSelect={() => {}} />

          {/* Profile Section (if exists) */}
          {profile && (
            <div className="mt-12">
              <div className="flex items-center space-x-2 mb-4">
                <Users className="w-5 h-5 text-royal-400" />
                <h3 className="text-lg font-semibold text-white">Your Target Audience Profile</h3>
              </div>
              
              {/* Success message */}
              <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Your target audience profile has been crafted successfully.</span>
              </div>

              {/* Profile header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">{profile.podcastName}</h2>
                  <p className="text-gray-400">{profile.wordCount} words</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCopyProfile}
                    className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/10 transition-all"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadProfile}
                    className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/10 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Profile content */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10">
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300 leading-relaxed text-sm sm:text-base">
                  {profile.profile}
                </div>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white mb-1">32</div>
                  <div className="text-sm text-gray-400">Questions Answered</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white mb-1">7</div>
                  <div className="text-sm text-gray-400">Sections Completed</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{profile.wordCount}</div>
                  <div className="text-sm text-gray-400">Words in Profile</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
