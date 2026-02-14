'use client';

import { useEffect, useState, Suspense } from 'react';
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
  Clock
} from 'lucide-react';
import { getProfile, processEpisode } from '@/lib/api';
import { ProfileData } from '@/lib/types';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams.get('profileId');
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Upload form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (profileId) {
      loadProfile();
    } else {
      setIsLoading(false);
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

  const validateYouTubeUrl = (url: string): boolean => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    
    if (url && !validateYouTubeUrl(url)) {
      setUrlError('Please enter a valid YouTube URL');
    } else {
      setUrlError('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateYouTubeUrl(youtubeUrl)) {
      setUrlError('Please enter a valid YouTube URL');
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

      // Redirect to processing page
      router.push(`/processing/${response.jobId}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to start processing');
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Profile</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link 
            href="/questionnaire"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Start New Questionnaire</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
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
              <Link 
                href="/questionnaire"
                className="px-4 py-2 text-sm font-medium text-white bg-royal-700 hover:bg-royal-600 rounded-lg transition-colors"
              >
                New Questionnaire
              </Link>
            </div>
          </div>
        </header>

        {/* Empty state */}
        <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-royal-800/50 flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-royal-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">No Profile Yet</h1>
            <p className="text-gray-400 mb-8">
              Complete the questionnaire to generate your detailed target audience profile. 
              It only takes about 10-15 minutes.
            </p>
            <Link 
              href="/questionnaire"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all hover:scale-105"
            >
              <Sparkles className="w-5 h-5" />
              <span>Start Questionnaire</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
                New Questionnaire
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Success message */}
          <div className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">Your target audience profile has been generated successfully!</span>
          </div>

          {/* Profile header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{profile.podcastName}</h1>
              <p className="text-gray-400">Target Audience Profile • {profile.wordCount} words</p>
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
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10 mb-10">
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300 leading-relaxed">
              {profile.profile}
            </div>
          </div>

          {/* Upload Episode Form */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-royal-800/50 to-royal-900/50 border border-royal-700/30">
            <div className="flex items-start space-x-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-royal-600/30 flex items-center justify-center flex-shrink-0">
                <Youtube className="w-6 h-6 text-royal-300" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Upload Your Episode</h3>
                <p className="text-gray-400">
                  Paste a YouTube URL to analyze your episode and get AI-generated clip suggestions 
                  optimized for your target audience.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-300 mb-2">
                  YouTube URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="youtubeUrl"
                    value={youtubeUrl}
                    onChange={handleUrlChange}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                      urlError 
                        ? 'border-red-500/50 focus:ring-red-500/50' 
                        : 'border-white/10 focus:ring-royal-500/50 focus:border-royal-500/50'
                    }`}
                    disabled={isUploading}
                  />
                  {youtubeUrl && !urlError && validateYouTubeUrl(youtubeUrl) && (
                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                  )}
                </div>
                {urlError && (
                  <p className="mt-2 text-sm text-red-400 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {urlError}
                  </p>
                )}
              </div>

              {uploadError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{uploadError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center text-sm text-gray-400">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Processing takes 2-5 minutes depending on episode length</span>
                </div>
                <button
                  type="submit"
                  disabled={isUploading || !youtubeUrl || !!urlError}
                  className="flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 disabled:bg-royal-800/50 disabled:text-royal-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Analyze Episode</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Info box */}
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-royal-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-400">
                  <p className="mb-1"><strong className="text-gray-300">What happens next:</strong></p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>We download and transcribe your episode using AI</li>
                    <li>Our AI analyzes the content for engaging 8-20 minute segments</li>
                    <li>You&apos;ll get 3-5 clip suggestions with optimized titles and timestamps</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
