'use client';

import Link from 'next/link';
import { ArrowRight, Target, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-royal-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-royal-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-royal-800/50 border border-royal-700/50 mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-royal-400" />
          <span className="text-sm text-royal-200">Intelligent Audience Profiling</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-slide-up">
          Elevate Your Content.
          <br />
          <span className="bg-gradient-to-r from-royal-400 to-royal-200 bg-clip-text text-transparent">
            Captivate Your Audience.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Through our refined intake process, we craft a bespoke target audience profile 
          that transforms how you connect with your listeners.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link 
            href="/dashboard"
            className="group flex items-center space-x-2 px-8 py-4 bg-royal-600 hover:bg-royal-500 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105"
          >
            <Target className="w-5 h-5" />
            <span>Upload Video</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            href="/questionnaire"
            className="group flex items-center space-x-2 px-8 py-4 bg-royal-700 hover:bg-royal-600 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105"
          >
            <Target className="w-5 h-5" />
            <span>Begin Your Consultation</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <Link 
            href="#features"
            className="px-8 py-4 text-gray-300 hover:text-white font-semibold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            Discover the Experience
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>7 Refined Sections</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>32 Insightful Questions</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Professionally Crafted Profile</span>
          </div>
        </div>
      </div>
    </section>
  );
}
