'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
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
  Youtube,
  AlertCircle,
  Clock,
  Play,
  History,
  Zap,
  Target,
  Film
} from 'lucide-react';
import { getProfile, processEpisode, getJobStatus } from '@/lib/api';
import { ProfileData, JobStatusResponse } from '@/lib/types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\s?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function isValidYouTubeUrl(url: string): boolean {
  if (!url.trim()) return false;
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return pattern.test(url);
}

async function fetchYouTubeMetadata(videoId: string) {
  try {
    // Try oEmbed first (no API key needed)
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title,
        author: data.author_name,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        exists: true
      };
    }
  } catch (e) {
    console.error('Failed to fetch metadata:', e);
  }
  
  // Fallback to thumbnail only
  return {
    title: null,
    author: null,
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    exists: true
  };
}

// ============================================================================
// RECENT EPISODES COMPONENT
// ============================================================================

interface RecentEpisode {
  jobId: string;
  podcastName: string;
  videoId: string;
  status: string;
  createdAt: string;
  clipCount?: number;
}

function RecentEpisodes({ onSelect }: { onSelect: (url: string) => void }) {
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
              <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-royal-900">
                <img 
                  src={`https://img.youtube.com/vi/${episode.videoId}/mqdefault.jpg`}
                  alt="Thumbnail"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" fill="%23ffffff20"%3E%3Crect width="120" height="90"/%3E%3C/svg%3E';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{episode.podcastName}</p>
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
      icon: <Youtube className="w-6 h-6" />,
      title: "Share Your Episode",
      description: "Provide any public YouTube content URL. We support both youtube.com and youtu.be links.",
      color: "text-red-400"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Intelligent Analysis",
      description: "Our system acquires, transcribes, and analyzes your episode with precision (~3 minutes).",
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
// URL PREVIEW COMPONENT
// ============================================================================

interface UrlPreviewProps {
  videoId: string;
  url: string;
  onClear: () => void;
}

function UrlPreview({ videoId, url, onClear }: UrlPreviewProps) {
  const [metadata, setMetadata] = useState<{
    title: string | null;
    author: string | null;
    thumbnail: string;
    exists: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchYouTubeMetadata(videoId).then((data) => {
      setMetadata(data);
      setIsLoading(false);
    });
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center space-x-4">
          <div className="w-32 h-20 rounded-lg bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-white/10 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
      <div className="flex items-start space-x-4">
        <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-royal-900">
          <img 
            src={metadata?.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" fill="%23ffffff20"%3E%3Crect width="120" height="90"/%3E%3C/svg%3E';
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {metadata?.title ? (
            <h4 className="text-white font-medium line-clamp-2" title={metadata.title}>
              {metadata.title}
            </h4>
          ) : (
            <h4 className="text-white font-medium">YouTube Content</h4>
          )}
          {metadata?.author && (
            <p className="text-sm text-gray-400 mt-1">{metadata.author}</p>
          )}
          <div className="flex items-center space-x-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-400 bg-green-400/10 rounded">
              <CheckCircle className="w-3 h-3 mr-1" />
              Valid URL
            </span>
            <button
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
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
  const [isLoading, setIsLoading] = useState(false); // TEMP: Bypass loading state for testing
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Upload form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);

  // TEMP: Bypass profile loading for testing
  useEffect(() => {
    if (profileId) {
      loadProfile();
    }
    // else: remain not loading, show form immediately
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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    setUploadError('');
    
    if (!url.trim()) {
      setUrlError('');
      setVideoId(null);
      return;
    }
    
    if (!isValidYouTubeUrl(url)) {
      setUrlError('Please enter a valid YouTube URL (youtube.com or youtu.be)');
      setVideoId(null);
    } else {
      setUrlError('');
      const extractedId = extractYouTubeId(url);
      setVideoId(extractedId);
    }
  };

  const handleClearUrl = () => {
    setYoutubeUrl('');
    setVideoId(null);
    setUrlError('');
    setUploadError('');
  };

  const saveToRecentEpisodes = (jobData: { jobId: string; podcastName: string; videoId: string; status: string; createdAt: string }) => {
    try {
      const stored = localStorage.getItem('recentEpisodes');
      const episodes: RecentEpisode[] = stored ? JSON.parse(stored) : [];
      
      // Add new episode to beginning
      episodes.unshift({
        jobId: jobData.jobId,
        podcastName: jobData.podcastName,
        videoId: jobData.videoId,
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
    
    if (!isValidYouTubeUrl(youtubeUrl)) {
      setUrlError('Please enter a valid YouTube URL');
      return;
    }

    const extractedId = extractYouTubeId(youtubeUrl);
    if (!extractedId) {
      setUrlError('Could not extract video ID from URL');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const response = await processEpisode({
        youtubeUrl: youtubeUrl.trim(),
        podcastName: profile?.podcastName || 'My Podcast',
        profileId: profileId || undefined,
      });

      // Save to recent episodes
      saveToRecentEpisodes({
        jobId: response.jobId,
        podcastName: profile?.podcastName || 'My Podcast',
        videoId: extractedId,
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

  // TEMP: Bypass profile loading checks for testing
  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
  //       <div className="text-center">
  //         <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
  //         <p className="text-gray-400">Accessing your profile...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // if (error) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
  //       <div className="text-center max-w-md">
  //         <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
  //           <FileText className="w-8 h-8 text-red-400" />
  //         </div>
  //         <h2 className="text-xl font-bold text-white mb-2">Error Loading Profile</h2>
  //         <p className="text-gray-400 mb-6">{error}</p>
  //         <Link 
  //           href="/questionnaire"
  //           className="inline-flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all"
  //         >
  //           <ArrowLeft className="w-5 h-5" />
  //           <span>Begin New Consultation</span>
  //         </Link>
  //       </div>
  //     </div>
  //   );
  // }

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
              Share a YouTube URL and our intelligent system will identify the finest 8-20 minute segments 
              curated for your audience.
            </p>
          </div>

          {/* Submit Episode Form */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-royal-800/50 to-royal-900/50 border border-royal-700/30">
            <form onSubmit={handleUpload} className="space-y-4">
              {/* URL Input */}
              <div>
                <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-300 mb-2">
                  YouTube URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </div>
                  <input
                    type="url"
                    id="youtubeUrl"
                    value={youtubeUrl}
                    onChange={handleUrlChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={`w-full pl-12 pr-12 py-4 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all text-base ${
                      urlError 
                        ? 'border-red-500/50 focus:ring-red-500/50' 
                        : videoId
                        ? 'border-green-500/50 focus:ring-green-500/50'
                        : 'border-white/10 focus:ring-royal-500/50 focus:border-royal-500/50'
                    }`}
                    disabled={isUploading}
                  />
                  {youtubeUrl && (
                    <button
                      type="button"
                      onClick={handleClearUrl}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                      <AlertCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                {/* Error Message */}
                {urlError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center animate-fadeIn">
                    <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    {urlError}
                  </p>
                )}
                
                {/* Success/Hint Message */}
                {!urlError && !videoId && (
                  <p className="mt-2 text-sm text-gray-500">
                    Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                  </p>
                )}
              </div>

              {/* URL Preview */}
              {videoId && !urlError && (
                <UrlPreview 
                  videoId={videoId} 
                  url={youtubeUrl}
                  onClear={handleClearUrl}
                />
              )}

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
                  disabled={isUploading || !youtubeUrl || !!urlError || !videoId}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-royal-600 hover:bg-royal-500 disabled:bg-royal-800/50 disabled:text-royal-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-base"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Initiating...</span>
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
          <RecentEpisodes onSelect={setYoutubeUrl} />

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

          {/* No Profile CTA - TEMPORARILY HIDDEN FOR TESTING */}
          {/* {!profile && !profileId && (
            <div className="mt-12 p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-royal-800/50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-royal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Create Your Target Audience Profile</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Complete a 10-15 minute consultation to develop a detailed target audience profile. 
                This enables our system to create refined segment recommendations tailored to your listeners.
              </p>
              <Link 
                href="/questionnaire"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all"
              >
                <Sparkles className="w-5 h-5" />
                <span>Begin Consultation</span>
              </Link>
            </div>
          )} */}
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
