'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { questionnaireSections } from '@/lib/questionnaireData';
import { saveQuestionnaire, generateProfile } from '@/lib/api';
import QuestionInput from '@/components/QuestionInput';

export default function QuestionnairePage() {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState(0);
  const [podcastName, setPodcastName] = useState('');
  const [hostNames, setHostNames] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const section = questionnaireSections[currentSection];
  const isFirstSection = currentSection === 0;
  const isLastSection = currentSection === questionnaireSections.length - 1;
  const progress = ((currentSection + 1) / questionnaireSections.length) * 100;

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const validateCurrentSection = () => {
    // Check if podcast name is filled on first section
    if (currentSection === 0 && !podcastName.trim()) {
      setError('Please enter your podcast name');
      return false;
    }

    // Check required questions in current section
    for (const question of section.questions) {
      if (question.required && !answers[question.id]) {
        setError(`Please answer: ${question.label}`);
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateCurrentSection()) {
      if (!isLastSection) {
        setCurrentSection((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePrevious = () => {
    if (!isFirstSection) {
      setCurrentSection((prev) => prev - 1);
      setError('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentSection()) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Save questionnaire
      const result = await saveQuestionnaire({
        podcastName,
        hostNames,
        answers,
      });

      // Generate profile
      setIsGenerating(true);
      const profileResult = await generateProfile(result.id);

      // Navigate to dashboard with profile
      router.push(`/dashboard?profileId=${profileResult.id}`);
    } catch (err) {
      console.error('Profile generation error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'An unexpected error occurred';
      if (err instanceof Error) {
        const errorText = err.message.toLowerCase();
        if (errorText.includes('network') || errorText.includes('fetch')) {
          errorMessage = 'Connection issue. Please check your internet and try again.';
        } else if (errorText.includes('timeout') || errorText.includes('504')) {
          errorMessage = 'Our AI is taking longer than usual. Please try again.';
        } else if (errorText.includes('quota') || errorText.includes('429')) {
          errorMessage = 'AI service is busy. Please try again in a few moments.';
        } else if (errorText.includes('unavailable') || errorText.includes('503')) {
          errorMessage = 'AI service temporarily unavailable. Please try again.';
        } else if (errorText.includes('failed')) {
          errorMessage = err.message;
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsSubmitting(false);
      setIsGenerating(false);
    }
  };

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-royal-950 to-royal-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-royal-500/20 blur-xl rounded-full animate-pulse-slow" />
            {isGenerating ? (
              <Sparkles className="relative w-16 h-16 text-royal-400 mx-auto animate-pulse" />
            ) : (
              <Loader2 className="relative w-16 h-16 text-royal-400 mx-auto animate-spin" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isGenerating ? 'Generating Your Profile...' : 'Saving Your Answers...'}
          </h2>
          <p className="text-gray-400">
            {isGenerating 
              ? 'Our AI is crafting your detailed target audience profile. This may take a moment.' 
              : 'Please wait while we save your questionnaire.'}
          </p>
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
            <div className="flex items-center space-x-4">
              <span className="text-white font-semibold">Pursue Segments</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400 text-sm">Questionnaire</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                Section {currentSection + 1} of {questionnaireSections.length}
              </span>
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div 
            className="h-full bg-gradient-to-r from-royal-600 to-royal-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Podcast Info - Only on first section */}
          {isFirstSection && (
            <div className="mb-10 p-6 rounded-2xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">Podcast Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Podcast Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={podcastName}
                    onChange={(e) => setPodcastName(e.target.value)}
                    placeholder="Enter your podcast name"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-royal-500 focus:ring-2 focus:ring-royal-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Host Name(s)
                  </label>
                  <input
                    type="text"
                    value={hostNames}
                    onChange={(e) => setHostNames(e.target.value)}
                    placeholder="Enter host name(s)"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-royal-500 focus:ring-2 focus:ring-royal-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 text-xs font-medium text-royal-300 bg-royal-900/50 rounded-full border border-royal-700/50">
                {section.id.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{section.title}</h1>
            <p className="text-gray-400">{section.description}</p>
          </div>

          {/* Questions */}
          <div className="space-y-8">
            {section.questions.map((question, index) => (
              <div 
                key={question.id}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <QuestionInput
                  question={question}
                  value={answers[question.id] || ''}
                  onChange={(value) => handleAnswerChange(question.id, value)}
                />
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 mb-3">{error}</p>
              <button
                onClick={() => setError('')}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-royal-950/90 backdrop-blur-md border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <button
              onClick={handlePrevious}
              disabled={isFirstSection}
              className={`
                flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all
                ${isFirstSection 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4" />
              <span>Auto-saving enabled</span>
            </div>

            {isLastSection ? (
              <button
                onClick={handleSubmit}
                className="flex items-center space-x-2 px-8 py-3 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                <span>Generate Profile</span>
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-8 py-3 bg-white text-royal-950 font-semibold rounded-xl transition-all hover:bg-gray-100 hover:scale-105"
              >
                <span>Next Section</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
