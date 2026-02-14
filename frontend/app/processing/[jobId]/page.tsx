'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Loader2, 
  ArrowLeft,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Mic,
  Sparkles,
  Youtube
} from 'lucide-react';
import { getJobStatus } from '@/lib/api';
import { JobStatusResponse, JobStatus } from '@/lib/types';

const statusConfig: Record<JobStatus, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  queued: {
    label: 'Queued',
    description: 'Waiting to start processing...',
    icon: <Clock className="w-6 h-6" />,
    color: 'text-yellow-400'
  },
  downloading: {
    label: 'Downloading',
    description: 'Downloading audio from YouTube...',
    icon: <Youtube className="w-6 h-6" />,
    color: 'text-red-400'
  },
  transcribing: {
    label: 'Transcribing',
    description: 'Converting audio to text with AI...',
    icon: <Mic className="w-6 h-6" />,
    color: 'text-blue-400'
  },
  analyzing: {
    label: 'Analyzing',
    description: 'AI finding the best clip segments...',
    icon: <Sparkles className="w-6 h-6" />,
    color: 'text-purple-400'
  },
  complete: {
    label: 'Complete',
    description: 'Analysis complete! Redirecting...',
    icon: <CheckCircle className="w-6 h-6" />,
    color: 'text-green-400'
  },
  failed: {
    label: 'Failed',
    description: 'Something went wrong. Please try again.',
    icon: <AlertCircle className="w-6 h-6" />,
    color: 'text-red-400'
  }
};

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dots, setDots] = useState('');

  // Animated dots for loading state
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    let pollInterval: NodeJS.Timeout;
    let redirectTimeout: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const data = await getJobStatus(jobId);
        setJob(data);
        setIsLoading(false);

        // If complete, redirect to results after a short delay
        if (data.status === 'complete') {
          clearInterval(pollInterval);
          redirectTimeout = setTimeout(() => {
            router.push(`/results/${jobId}`);
          }, 1500);
        }

        // If failed, stop polling
        if (data.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check job status');
        setIsLoading(false);
      }
    };

    // Check immediately
    checkStatus();

    // Then poll every 2 seconds
    pollInterval = setInterval(checkStatus, 2000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(redirectTimeout);
    };
  }, [jobId, router]);

  const currentStatus = job?.status || 'queued';
  const statusInfo = statusConfig[currentStatus];

  // Calculate progress percentage based on status
  const getProgressPercent = () => {
    switch (currentStatus) {
      case 'queued': return 5;
      case 'downloading': return 25;
      case 'transcribing': return 55;
      case 'analyzing': return 85;
      case 'complete': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading job status...</p>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link 
            href="/dashboard"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
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
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link 
            href="/dashboard"
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          {/* Main content */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">
              {currentStatus === 'complete' ? 'Analysis Complete!' : 'Processing Episode'}
            </h1>
            <p className="text-gray-400">
              {job?.podcastName || 'Your podcast episode'}
            </p>
          </div>

          {/* Progress visualization */}
          <div className="mb-12">
            {/* Progress bar */}
            <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-8">
              <div 
                className="h-full bg-gradient-to-r from-royal-600 to-royal-400 transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>

            {/* Status steps */}
            <div className="grid grid-cols-5 gap-2">
              {(['queued', 'downloading', 'transcribing', 'analyzing', 'complete'] as JobStatus[]).map((status, index) => {
                const isActive = status === currentStatus;
                const isPast = ['queued', 'downloading', 'transcribing', 'analyzing', 'complete'].indexOf(currentStatus) > index;
                const isComplete = status === 'complete' && currentStatus === 'complete';

                return (
                  <div key={status} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                      isComplete ? 'bg-green-500/20 text-green-400' :
                      isActive ? 'bg-royal-500/20 text-royal-400' :
                      isPast ? 'bg-royal-600/20 text-royal-500' :
                      'bg-white/5 text-gray-600'
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isPast ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-current" />
                      )}
                    </div>
                    <span className={`text-xs capitalize ${
                      isActive ? 'text-white' : 
                      isPast ? 'text-gray-400' : 
                      'text-gray-600'
                    }`}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current status card */}
          <div className={`p-8 rounded-2xl border ${
            currentStatus === 'failed' 
              ? 'bg-red-500/5 border-red-500/20' 
              : currentStatus === 'complete'
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className={`${statusInfo.color} ${currentStatus !== 'complete' && currentStatus !== 'failed' ? 'animate-pulse' : ''}`}>
                {statusInfo.icon}
              </div>
              <h2 className={`text-xl font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
                {currentStatus !== 'complete' && currentStatus !== 'failed' && dots}
              </h2>
            </div>
            <p className="text-center text-gray-400">
              {job?.progressMessage || statusInfo.description}
            </p>

            {/* Show transcript progress if available */}
            {job?.transcript && currentStatus !== 'failed' && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                  <FileText className="w-5 h-5 text-royal-400" />
                  <span className="text-white font-medium">Transcription Complete</span>
                </div>
                <p className="text-sm text-gray-400 ml-8">
                  Duration: {job.transcript.duration} • {job.transcript.segments.length.toLocaleString()} segments
                </p>
              </div>
            )}

            {/* Show clips found if available */}
            {job?.clips && currentStatus !== 'failed' && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-medium">Clips Found</span>
                </div>
                <p className="text-sm text-gray-400 ml-8">
                  {job.clipCount} engaging segments identified
                </p>
              </div>
            )}

            {/* Error details if failed */}
            {currentStatus === 'failed' && job?.error && (
              <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">
                  <strong>Error:</strong> {job.error}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {currentStatus === 'failed' ? (
              <>
                <Link 
                  href="/dashboard"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all border border-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Try Different URL</span>
                </Link>
              </>
            ) : currentStatus === 'complete' ? (
              <button
                onClick={() => router.push(`/results/${jobId}`)}
                className="inline-flex items-center space-x-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all"
              >
                <CheckCircle className="w-5 h-5" />
                <span>View Results</span>
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                This page will automatically update. No need to refresh.
              </p>
            )}
          </div>

          {/* Processing info */}
          <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-white font-semibold mb-4">What&apos;s happening?</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                  1
                </div>
                <p><strong className="text-gray-300">Download:</strong> We extract the audio from your YouTube video for faster processing.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                  2
                </div>
                <p><strong className="text-gray-300">Transcribe:</strong> OpenAI Whisper converts the audio into timestamped text with high accuracy.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs">
                  3
                </div>
                <p><strong className="text-gray-300">Analyze:</strong> Gemini AI finds engaging segments optimized for your target audience.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
