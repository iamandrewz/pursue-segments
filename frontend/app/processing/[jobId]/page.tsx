'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Youtube,
  RotateCcw,
  ExternalLink,
  Zap,
  Lightbulb,
  TrendingUp,
  Eye,
  MessageCircle,
  Target
} from 'lucide-react';
import { getJobStatus } from '@/lib/api';
import { JobStatusResponse, JobStatus } from '@/lib/types';

// ============================================================================
// INSIGHTS AND TIPS
// ============================================================================

const insights = [
  {
    icon: <TrendingUp className="w-5 h-5" />,
    text: "Did you know? The average refined segment receives 3x more engagement than full episodes."
  },
  {
    icon: <Eye className="w-5 h-5" />,
    text: "Insight: Timestamps in your titles enhance viewer retention significantly."
  },
  {
    icon: <Zap className="w-5 h-5" />,
    text: "Did you know? 8-20 minute segments achieve the highest engagement rates on YouTube."
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    text: "Insight: Segments with compelling openings in the first 30 seconds perform 2x better."
  },
  {
    icon: <Target className="w-5 h-5" />,
    text: "Did you know? Specific examples and precise details increase shareability."
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    text: "Insight: Curiosity-driven titles attract 40% more attention than purely descriptive ones."
  }
];

// ============================================================================
// STAGE CONFIGURATION
// ============================================================================

interface StageConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  estimatedSeconds: number;
}

const stageConfig: Record<JobStatus, StageConfig> = {
  queued: {
    label: 'Queued',
    description: 'Awaiting commencement of refinement...',
    icon: <Clock className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    estimatedSeconds: 5
  },
  downloading: {
    label: 'Acquiring',
    description: 'Retrieving content from source...',
    icon: <Youtube className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    estimatedSeconds: 45
  },
  transcribing: {
    label: 'Analyzing Dialogue',
    description: 'Transcribing and examining content...',
    icon: <Mic className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    estimatedSeconds: 120
  },
  analyzing: {
    label: 'Curating Moments',
    description: 'Identifying the most engaging segments...',
    icon: <Sparkles className="w-5 h-5" />,
    activeIcon: <Loader2 className="w-5 h-5 animate-spin" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    estimatedSeconds: 60
  },
  complete: {
    label: 'Complete',
    description: 'Refinement complete. Preparing your results...',
    icon: <CheckCircle className="w-5 h-5" />,
    activeIcon: <CheckCircle className="w-5 h-5" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    estimatedSeconds: 0
  },
  failed: {
    label: 'Failed',
    description: 'An issue occurred. Please try again.',
    icon: <AlertCircle className="w-5 h-5" />,
    activeIcon: <AlertCircle className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    estimatedSeconds: 0
  }
};

const stageOrder: JobStatus[] = ['queued', 'downloading', 'transcribing', 'analyzing', 'complete'];

// ============================================================================
// ERROR RECOVERY COMPONENT
// ============================================================================

interface ErrorRecoveryProps {
  error: string;
  stage: JobStatus;
  onRetry: () => void;
  onNewVideo: () => void;
}

function ErrorRecovery({ error, stage, onRetry, onNewVideo }: ErrorRecoveryProps) {
  const isDownloadError = stage === 'downloading' || error.toLowerCase().includes('download');
  const isTranscriptionError = stage === 'transcribing' || error.toLowerCase().includes('transcrib');
  
  return (
    <div className="mt-8 p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">
            Processing Failed
          </h3>
          <p className="text-gray-400 mb-4">{error}</p>
          
          {isDownloadError && (
            <div className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">
                <strong className="text-gray-300">Common causes:</strong>
              </p>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Content is private or unlisted</li>
                <li>Content has been removed</li>
                <li>Copyright restrictions</li>
                <li>Temporary source rate limiting</li>
              </ul>
            </div>
          )}
          
          {isTranscriptionError && (
            <div className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400">
                <strong className="text-gray-300">Note:</strong> Analysis errors are usually temporary. 
                You may retry with the same content.
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            {!isDownloadError && (
              <button
                onClick={onRetry}
                className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-royal-600 hover:bg-royal-500 text-white font-medium rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={onNewVideo}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all border border-white/10"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Try Different Content</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INSIGHT ROTATOR
// ============================================================================

function InsightRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % insights.length);
        setIsVisible(true);
      }, 300);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const insight = insights[currentIndex];

  return (
    <div className="mt-8 p-6 rounded-2xl bg-royal-900/30 border border-royal-700/30">
      <div 
        className={`flex items-start space-x-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="w-10 h-10 rounded-xl bg-royal-600/20 flex items-center justify-center flex-shrink-0 text-royal-400">
          {insight.icon}
        </div>
        <div>
          <p className="text-sm font-medium text-royal-300 mb-1">While you wait...</p>
          <p className="text-gray-300">{insight.text}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center space-x-1.5">
        {insights.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              index === currentIndex ? 'bg-royal-400 w-4' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

function AnimatedProgressBar({ 
  progress, 
  stage 
}: { 
  progress: number; 
  stage: JobStatus;
}) {
  const getBarColor = () => {
    switch (stage) {
      case 'failed': return 'from-red-600 to-red-400';
      case 'complete': return 'from-green-600 to-green-400';
      default: return 'from-royal-600 via-royal-500 to-royal-400';
    }
  };

  return (
    <div className="h-4 bg-white/5 rounded-full overflow-hidden">
      <div 
        className={`h-full bg-gradient-to-r ${getBarColor()} transition-all duration-1000 ease-out rounded-full relative`}
        style={{ width: `${progress}%` }}
      >
        {stage !== 'complete' && stage !== 'failed' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE TIMELINE COMPONENT
// ============================================================================

function StageTimeline({ currentStatus }: { currentStatus: JobStatus }) {
  const currentIndex = stageOrder.indexOf(currentStatus);

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-4">
      {stageOrder.map((status, index) => {
        const config = stageConfig[status];
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const isComplete = status === 'complete' && currentStatus === 'complete';
        const isFailed = currentStatus === 'failed' && index === currentIndex;

        return (
          <div key={status} className="flex flex-col items-center">
            <div 
              className={`
                w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 
                transition-all duration-500 border-2
                ${isFailed ? 'bg-red-500/20 border-red-500 text-red-400' :
                  isComplete ? 'bg-green-500/20 border-green-500 text-green-400' :
                  isActive ? `${config.bgColor} ${config.borderColor} ${config.color} scale-110 shadow-lg shadow-${config.color.split('-')[1]}-500/20` :
                  isPast ? 'bg-royal-600/20 border-royal-600 text-royal-400' :
                  'bg-white/5 border-white/10 text-gray-600'}
              `}
            >
              {isFailed ? (
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : isComplete || isPast ? (
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : isActive ? (
                <div className="animate-pulse">{config.icon}</div>
              ) : (
                <div className="w-2 h-2 rounded-full bg-current" />
              )}
            </div>
            <span className={`text-xs capitalize text-center transition-colors ${
              isActive ? 'text-white font-medium' : 
              isPast ? 'text-gray-400' : 
              'text-gray-600'
            }`}>
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate estimated remaining time
  useEffect(() => {
    if (!job) return;
    
    const currentStageIndex = stageOrder.indexOf(job.status);
    let remainingSeconds = 0;
    
    // Add remaining time for current stage (estimate 50% done)
    if (job.status !== 'complete' && job.status !== 'failed') {
      const currentConfig = stageConfig[job.status];
      remainingSeconds += Math.ceil(currentConfig.estimatedSeconds * 0.5);
    }
    
    // Add time for upcoming stages
    for (let i = currentStageIndex + 1; i < stageOrder.length - 1; i++) {
      remainingSeconds += stageConfig[stageOrder[i]].estimatedSeconds;
    }
    
    setEstimatedRemaining(remainingSeconds > 0 ? remainingSeconds : null);
  }, [job?.status]);

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
          }, 2000);
        }

        // If failed, stop polling
        if (data.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check status');
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
  const statusInfo = stageConfig[currentStatus];

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

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  };

  const handleRetry = () => {
    // Reload the page to restart polling (job will continue if possible)
    window.location.reload();
  };

  const handleNewVideo = () => {
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Accessing refinement status...</p>
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
            <span>Return to Studio</span>
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
            <Link 
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link 
            href="/dashboard"
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Studio</span>
          </Link>

          {/* Main content */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {currentStatus === 'complete' ? 'Refinement Complete' : 
               currentStatus === 'failed' ? 'Processing Failed' :
               'Refining Your Episode'}
            </h1>
            <p className="text-gray-400">
              {job?.podcastName || 'Your podcast episode'}
            </p>
          </div>

          {/* Progress Section */}
          <div className="mb-8">
            {/* Progress bar */}
            <AnimatedProgressBar progress={getProgressPercent()} stage={currentStatus} />
            
            {/* Percentage and time estimate */}
            <div className="flex items-center justify-between mt-3 text-sm">
              <span className="text-gray-400">
                {getProgressPercent()}% complete
              </span>
              {estimatedRemaining && currentStatus !== 'complete' && currentStatus !== 'failed' && (
                <span className="text-royal-400">
                  ~{formatTime(estimatedRemaining)} remaining
                </span>
              )}
            </div>

            {/* Stage timeline */}
            <div className="mt-8">
              <StageTimeline currentStatus={currentStatus} />
            </div>
          </div>

          {/* Current status card */}
          <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
            currentStatus === 'failed' 
              ? 'bg-red-500/5 border-red-500/20' 
              : currentStatus === 'complete'
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className={`${statusInfo.color} ${currentStatus !== 'complete' && currentStatus !== 'failed' ? 'animate-pulse' : ''}`}>
                {currentStatus === 'complete' || currentStatus === 'failed' 
                  ? statusInfo.icon 
                  : statusInfo.activeIcon}
              </div>
              <h2 className={`text-xl sm:text-2xl font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </h2>
            </div>
            <p className="text-center text-gray-400">
              {job?.progressMessage || statusInfo.description}
            </p>

            {/* Processing details */}
            {(job?.transcript || job?.clips) && currentStatus !== 'failed' && (
              <div className="mt-6 space-y-3">
                {job?.transcript && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">Dialogue Analysis Complete</p>
                      <p className="text-sm text-gray-400">
                        {job.transcript.duration} • {job.transcript.segments.length.toLocaleString()} segments
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                )}

                {job?.clips && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">Segments Curated</p>
                      <p className="text-sm text-gray-400">
                        {job.clipCount} refined moments identified
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Insights (only while processing) */}
          {currentStatus !== 'complete' && currentStatus !== 'failed' && (
            <InsightRotator />
          )}

          {/* Error recovery */}
          {currentStatus === 'failed' && job?.error && (
            <ErrorRecovery 
              error={job.error}
              stage={currentStatus}
              onRetry={handleRetry}
              onNewVideo={handleNewVideo}
            />
          )}

          {/* Action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {currentStatus === 'complete' ? (
              <button
                onClick={() => router.push(`/results/${jobId}`)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-600/20"
              >
                <CheckCircle className="w-5 h-5" />
                <span>View Your Collection</span>
              </button>
            ) : currentStatus === 'failed' ? (
              <Link 
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Return to Studio</span>
              </Link>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  This page updates automatically
                </p>
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Connected</span>
                </div>
              </div>
            )}
          </div>

          {/* Processing pipeline info */}
          <div className="mt-12 p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-white font-semibold mb-4 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-yellow-400" />
              The Refinement Process
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  currentStatus === 'queued' || currentStatus === 'downloading' ? 'bg-red-500/20 text-red-400' :
                  stageOrder.indexOf(currentStatus) > stageOrder.indexOf('downloading') ? 'bg-green-500/20 text-green-400' :
                  'bg-white/10 text-gray-500'
                }`}>
                  {stageOrder.indexOf(currentStatus) > stageOrder.indexOf('downloading') ? '✓' : '1'}
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Acquire</p>
                  <p className="text-gray-500">Retrieve content from source with precision</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  currentStatus === 'transcribing' ? 'bg-blue-500/20 text-blue-400' :
                  stageOrder.indexOf(currentStatus) > stageOrder.indexOf('transcribing') ? 'bg-green-500/20 text-green-400' :
                  'bg-white/10 text-gray-500'
                }`}>
                  {stageOrder.indexOf(currentStatus) > stageOrder.indexOf('transcribing') ? '✓' : '2'}
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Transcribe</p>
                  <p className="text-gray-500">Convert dialogue to timestamped text with accuracy</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  currentStatus === 'analyzing' ? 'bg-purple-500/20 text-purple-400' :
                  stageOrder.indexOf(currentStatus) > stageOrder.indexOf('analyzing') ? 'bg-green-500/20 text-green-400' :
                  'bg-white/10 text-gray-500'
                }`}>
                  {stageOrder.indexOf(currentStatus) > stageOrder.indexOf('analyzing') ? '✓' : '3'}
                </div>
                <div>
                  <p className="text-gray-300 font-medium">Curate</p>
                  <p className="text-gray-500">Identify engaging moments tailored for your audience</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
