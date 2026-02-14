'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  CheckCircle
} from 'lucide-react';
import { getProfile } from '@/lib/api';
import { ProfileData } from '@/lib/types';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

          {/* Upload Episode CTA */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-royal-800/50 to-royal-900/50 border border-royal-700/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-royal-600/30 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-6 h-6 text-royal-300" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Upload Your Episode</h3>
                  <p className="text-gray-400">
                    Coming soon: Upload your podcast episodes and get AI-generated clip suggestions 
                    optimized for your target audience.
                  </p>
                </div>
              </div>
              <button
                disabled
                className="flex-shrink-0 px-6 py-3 bg-royal-700/50 text-royal-300 font-medium rounded-xl cursor-not-allowed"
              >
                Coming Soon
              </button>
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
