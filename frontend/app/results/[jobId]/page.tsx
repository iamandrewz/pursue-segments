'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Loader2, 
  ArrowLeft,
  Clock,
  Quote,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Play,
  AlertCircle,
  Sparkles,
  CheckCircle,
  Wand2
} from 'lucide-react';
import { getJobStatus } from '@/lib/api';
import { JobStatusResponse, ClipSuggestion } from '@/lib/types';

interface ClipCardProps {
  clip: ClipSuggestion;
  index: number;
  selectedTitle: string;
  onSelectTitle: (title: string) => void;
}

function ClipCard({ clip, index, selectedTitle, onSelectTitle }: ClipCardProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = `${selectedTitle}\n\n${clip.engaging_quote}\n\nDuration: ${clip.duration_minutes} minutes (${clip.start_timestamp} - ${clip.end_timestamp})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-royal-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-royal-600/30 flex items-center justify-center">
            <span className="text-royal-300 font-bold">{index + 1}</span>
          </div>
          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{clip.duration_minutes} min</span>
              <span>•</span>
              <span>{clip.start_timestamp} - {clip.end_timestamp}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          title="Copy clip info"
        >
          {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Download className="w-5 h-5" />}
        </button>
      </div>

      {/* Title Options */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Choose a Title
        </label>
        <div className="space-y-2">
          <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
            <input
              type="radio"
              name={`title-${index}`}
              value={clip.title_options.punchy}
              checked={selectedTitle === clip.title_options.punchy}
              onChange={(e) => onSelectTitle(e.target.value)}
              className="mt-1 w-4 h-4 text-royal-500 border-gray-600 focus:ring-royal-500"
            />
            <div>
              <span className="text-xs text-purple-400 font-medium uppercase">Punchy</span>
              <p className="text-white font-medium">{clip.title_options.punchy}</p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
            <input
              type="radio"
              name={`title-${index}`}
              value={clip.title_options.benefit}
              checked={selectedTitle === clip.title_options.benefit}
              onChange={(e) => onSelectTitle(e.target.value)}
              className="mt-1 w-4 h-4 text-royal-500 border-gray-600 focus:ring-royal-500"
            />
            <div>
              <span className="text-xs text-blue-400 font-medium uppercase">Benefit-Driven</span>
              <p className="text-white font-medium">{clip.title_options.benefit}</p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
            <input
              type="radio"
              name={`title-${index}`}
              value={clip.title_options.curiosity}
              checked={selectedTitle === clip.title_options.curiosity}
              onChange={(e) => onSelectTitle(e.target.value)}
              className="mt-1 w-4 h-4 text-royal-500 border-gray-600 focus:ring-royal-500"
            />
            <div>
              <span className="text-xs text-green-400 font-medium uppercase">Curiosity</span>
              <p className="text-white font-medium">{clip.title_options.curiosity}</p>
            </div>
          </label>
        </div>
      </div>

      {/* Engaging Quote */}
      <div className="mb-6 p-4 rounded-xl bg-royal-900/30 border border-royal-700/30">
        <div className="flex items-start space-x-3">
          <Quote className="w-5 h-5 text-royal-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-gray-300 italic leading-relaxed">&ldquo;{clip.engaging_quote}&rdquo;</p>
          </div>
        </div>
      </div>

      {/* Why It Works */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-300">Why This Works</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{clip.why_it_works}</p>
      </div>

      {/* Transcript Toggle */}
      <div className="border-t border-white/10 pt-4">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              View Transcript Excerpt
            </span>
          </div>
          {showTranscript ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showTranscript && (
          <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/5 max-h-64 overflow-y-auto">
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
              {clip.transcript_excerpt}
            </p>
          </div>
        )}
      </div>

      {/* Generate Clip Button */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <button
          disabled
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-royal-700/30 text-royal-400 font-medium rounded-xl cursor-not-allowed opacity-60"
          title="Clip encoding coming soon with Mac Mini M4 hardware acceleration"
        >
          <Wand2 className="w-5 h-5" />
          <span>Generate Clip (Coming Soon)</span>
        </button>
        <p className="mt-2 text-xs text-center text-gray-500">
          Hardware-accelerated encoding available Feb 20
        </p>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitles, setSelectedTitles] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!jobId) return;

    const fetchJob = async () => {
      try {
        const data = await getJobStatus(jobId);
        setJob(data);
        
        // Initialize selected titles
        if (data.clips) {
          const initialTitles: Record<number, string> = {};
          data.clips.forEach((clip, index) => {
            initialTitles[index] = clip.title_options.punchy;
          });
          setSelectedTitles(initialTitles);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  const handleSelectTitle = (index: number, title: string) => {
    setSelectedTitles(prev => ({ ...prev, [index]: title }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
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

  if (!job || job.status !== 'complete' || !job.clips) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Results Not Ready</h2>
          <p className="text-gray-400 mb-6">
            The analysis is still in progress or failed. Please check the processing page.
          </p>
          <Link 
            href={`/processing/${jobId}`}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Check Progress</span>
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
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Success message */}
          <div className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">
              Analysis complete! We found {job.clipCount} engaging clip{job.clipCount !== 1 ? 's' : ''} for your episode.
            </span>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">Clip Suggestions</h1>
            <p className="text-gray-400">
              {job.podcastName} • {job.transcript?.duration || 'Unknown duration'}
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white mb-1">{job.clipCount}</div>
              <div className="text-xs text-gray-400">Clips Found</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {Math.round(job.clips.reduce((acc, clip) => acc + clip.duration_minutes, 0))}
              </div>
              <div className="text-xs text-gray-400">Total Minutes</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {Math.round(job.clips.reduce((acc, clip) => acc + clip.duration_minutes, 0) / job.clipCount)}
              </div>
              <div className="text-xs text-gray-400">Avg Duration</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {job.transcript?.segments.length.toLocaleString() || 0}
              </div>
              <div className="text-xs text-gray-400">Transcript Segments</div>
            </div>
          </div>

          {/* Clip cards */}
          <div className="space-y-6">
            {job.clips.map((clip, index) => (
              <ClipCard
                key={index}
                clip={clip}
                index={index}
                selectedTitle={selectedTitles[index] || clip.title_options.punchy}
                onSelectTitle={(title) => handleSelectTitle(index, title)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Analyze Another Episode</span>
            </Link>
          </div>

          {/* Tips */}
          <div className="mt-12 p-6 rounded-xl bg-royal-900/30 border border-royal-700/30">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-royal-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold mb-2">Pro Tips</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li>• <strong className="text-gray-300">Test different titles:</strong> Try A/B testing the punchy vs curiosity titles to see what gets more clicks.</li>
                  <li>• <strong className="text-gray-300">Hook within 30 seconds:</strong> The most engaging clips hook viewers immediately - use the engaging quote as your opening.</li>
                  <li>• <strong className="text-gray-300">8-20 minutes is the sweet spot:</strong> Long-form clips perform better for podcast content than short snippets.</li>
                  <li>• <strong className="text-gray-300">Coming Feb 20:</strong> Hardware-accelerated clip generation with Mac Mini M4 for 30-second encodes.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
