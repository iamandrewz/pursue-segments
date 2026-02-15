'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Loader2, 
  ArrowLeft,
  Save,
  Download,
  Clock,
  Type,
  Hash,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { 
  getFullTranscript, 
  saveClip, 
  exportClips, 
  FullTranscriptResponse,
  TranscriptSegmentWithTimestamp,
  ClipSuggestion 
} from '@/lib/api';

interface TranscriptEditorProps {
  jobId: string;
}

export default function TranscriptEditor({ jobId }: TranscriptEditorProps) {
  const [data, setData] = useState<FullTranscriptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Clip boundaries (in seconds)
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Snap to sentence mode
  const [snapToSentence, setSnapToSentence] = useState(true);

  // Load transcript data
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getFullTranscript(jobId);
        setData(result);
        
        // Initialize clip boundaries from first clip
        if (result.clips && result.clips.length > 0) {
          const firstClip = result.clips[0];
          setClipStart(parseTimestamp(firstClip.start_timestamp));
          setClipEnd(parseTimestamp(firstClip.end_timestamp));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [jobId]);

  // Parse timestamp to seconds
  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  };

  // Format seconds to timestamp
  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find sentence boundaries (snap points)
  const findSentenceBoundaries = useCallback((segments: TranscriptSegmentWithTimestamp[]): number[] => {
    const boundaries: number[] = [];
    const sentenceEnders = /[.!?]\s+/;
    
    segments.forEach((seg) => {
      const words = seg.text.split(sentenceEnders);
      let currentTime = seg.start_seconds;
      const duration = (seg.end_seconds - seg.start_seconds) / words.length;
      
      words.forEach((word, i) => {
        if (i > 0) {
          boundaries.push(currentTime);
        }
        currentTime += duration;
      });
    });
    
    return boundaries;
  }, []);

  // Snap to nearest sentence boundary
  const snapToNearestBoundary = useCallback((seconds: number, segments: TranscriptSegmentWithTimestamp[]): number => {
    if (!snapToSentence) return seconds;
    
    const boundaries = findSentenceBoundaries(segments);
    if (boundaries.length === 0) return seconds;
    
    // Find closest boundary within 5 seconds
    const closest = boundaries.reduce((prev, curr) => 
      Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
    );
    
    if (Math.abs(closest - seconds) < 5) {
      return closest;
    }
    return seconds;
  }, [snapToSentence, findSentenceBoundaries]);

  // Handle drag on timeline
  const handleTimelineMouseDown = (type: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTimelineMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || !data) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    // Total duration in seconds
    const totalDuration = data.segments.length > 0 
      ? data.segments[data.segments.length - 1].end_seconds 
      : 0;
    
    let newTime = percentage * totalDuration;
    
    // Snap to sentence boundary
    newTime = snapToNearestBoundary(newTime, data.segments);
    
    if (isDragging === 'start') {
      setClipStart(Math.min(newTime, clipEnd - 5)); // Min 5 seconds duration
    } else {
      setClipEnd(Math.max(newTime, clipStart + 5));
    }
  }, [isDragging, data, clipStart, clipEnd, snapToNearestBoundary]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleTimelineMouseMove);
      document.addEventListener('mouseup', handleTimelineMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleTimelineMouseMove);
      document.removeEventListener('mouseup', handleTimelineMouseUp);
    };
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  // Get clip text based on current boundaries
  const getClipText = useCallback((): string => {
    if (!data) return '';
    
    const clipSegments = data.segments.filter(
      seg => seg.start_seconds >= clipStart && seg.end_seconds <= clipEnd
    );
    
    return clipSegments.map(seg => seg.text).join(' ');
  }, [data, clipStart, clipEnd]);

  // Word count and character count
  const clipText = getClipText();
  const wordCount = clipText.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = clipText.length;
  const duration = clipEnd - clipStart;
  const durationMinutes = duration / 60;

  // Handle clip selection
  const handleClipSelect = (index: number) => {
    if (!data || !data.clips) return;
    
    setActiveClipIndex(index);
    const clip = data.clips[index];
    setClipStart(parseTimestamp(clip.start_timestamp));
    setClipEnd(parseTimestamp(clip.end_timestamp));
  };

  // Save clip
  const handleSaveClip = async () => {
    if (!data) return;
    
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await saveClip({
        jobId: jobId,
        clipIndex: activeClipIndex,
        startTimestamp: formatTimestamp(clipStart),
        endTimestamp: formatTimestamp(clipEnd),
        transcriptExcerpt: clipText,
      });
      
      setSaveMessage('Clip saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save clip');
    } finally {
      setIsSaving(false);
    }
  };

  // Export all clips
  const handleExport = async () => {
    try {
      const exportData = await exportClips(jobId);
      
      // Create download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clips-${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export clips');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-royal-400 mx-auto animate-spin mb-4" />
          <p className="text-gray-400">Loading transcript editor...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error || 'Failed to load data'}</p>
        </div>
      </div>
    );
  }

  // Calculate positions for timeline
  const totalDuration = data.segments.length > 0 
    ? data.segments[data.segments.length - 1].end_seconds 
    : 1;
  
  const startPos = (clipStart / totalDuration) * 100;
  const endPos = (clipEnd / totalDuration) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-royal-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a href={`/results/${jobId}`} className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Results</span>
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all border border-white/10"
              >
                <Download className="w-4 h-4" />
                <span>Export All</span>
              </button>
              <button
                onClick={handleSaveClip}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 bg-royal-600 hover:bg-royal-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Clip'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Clip selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Select Clip to Edit
            </label>
            <div className="flex flex-wrap gap-2">
              {data.clips?.map((clip, index) => (
                <button
                  key={index}
                  onClick={() => handleClipSelect(index)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    activeClipIndex === index
                      ? 'bg-royal-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  Clip {index + 1} ({clip.start_timestamp} - {clip.end_timestamp})
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-6 p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Timeline Editor</h3>
              <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snapToSentence}
                  onChange={(e) => setSnapToSentence(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-royal-500 focus:ring-royal-500"
                />
                <span>Snap to sentence boundaries</span>
              </label>
            </div>
            
            {/* Timeline bar */}
            <div 
              ref={containerRef}
              className="relative h-16 bg-black/30 rounded-xl cursor-pointer"
            >
              {/* Segment markers */}
              {data.segments.map((seg, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-white/5 border-l border-white/10"
                  style={{
                    left: `${(seg.start_seconds / totalDuration) * 100}%`,
                    width: `${((seg.end_seconds - seg.start_seconds) / totalDuration) * 100}%`
                  }}
                />
              ))}
              
              {/* Highlighted clip region */}
              <div
                className="absolute top-0 bottom-0 bg-royal-500/30 border-x-2 border-royal-400"
                style={{
                  left: `${startPos}%`,
                  width: `${endPos - startPos}%`
                }}
              />
              
              {/* Start handle */}
              <div
                className="absolute top-0 bottom-0 w-4 bg-royal-500 cursor-ew-resize hover:bg-royal-400 transition-colors z-10 flex items-center justify-center"
                style={{ left: `${startPos}%`, transform: 'translateX(-50%)' }}
                onMouseDown={handleTimelineMouseDown('start')}
              >
                <div className="w-1 h-8 bg-white/50 rounded-full" />
              </div>
              
              {/* End handle */}
              <div
                className="absolute top-0 bottom-0 w-4 bg-royal-500 cursor-ew-resize hover:bg-royal-400 transition-colors z-10 flex items-center justify-center"
                style={{ left: `${endPos}%`, transform: 'translateX(-50%)' }}
                onMouseDown={handleTimelineMouseDown('end')}
              >
                <div className="w-1 h-8 bg-white/50 rounded-full" />
              </div>
            </div>
            
            {/* Time display */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-royal-400" />
                <span className="text-white font-mono">{formatTimestamp(clipStart)}</span>
              </div>
              <div className="text-gray-400">
                Duration: <span className="text-white font-medium">{durationMinutes.toFixed(1)} min</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-royal-400" />
                <span className="text-white font-mono">{formatTimestamp(clipEnd)}</span>
              </div>
            </div>
          </div>

          {/* Stats and preview row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Clip stats */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Clip Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Type className="w-4 h-4" />
                    <span>Words</span>
                  </div>
                  <span className="text-white font-mono">{wordCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Hash className="w-4 h-4" />
                    <span>Characters</span>
                  </div>
                  <span className="text-white font-mono">{charCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Duration</span>
                  </div>
                  <span className="text-white font-mono">{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            {/* Clip preview */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Clip Preview</h3>
                {saveMessage && (
                  <div className={`flex items-center space-x-2 text-sm ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                    {saveMessage.includes('success') ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span>{saveMessage}</span>
                  </div>
                )}
              </div>
              <div className="p-4 rounded-xl bg-black/30 border border-white/5 max-h-48 overflow-y-auto">
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {clipText || 'No text in selected range'}
                </p>
              </div>
            </div>
          </div>

          {/* Full transcript */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Full Transcript</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.segments.map((seg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg transition-colors cursor-pointer ${
                    seg.start_seconds >= clipStart && seg.end_seconds <= clipEnd
                      ? 'bg-royal-500/20 border border-royal-500/30'
                      : 'hover:bg-white/5'
                  }`}
                  onClick={() => {
                    setClipStart(seg.start_seconds);
                    setClipEnd(seg.end_seconds);
                  }}
                >
                  <span className="text-royal-400 font-mono text-sm">[{seg.start}]</span>
                  <span className="text-gray-300 ml-2">{seg.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
