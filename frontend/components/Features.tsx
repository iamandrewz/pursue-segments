'use client';

import { Target, Users, Zap, FileText, TrendingUp, MessageSquare } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Precision Targeting',
    description: 'Define your ideal listener with 32 detailed questions across 7 strategic sections.',
  },
  {
    icon: Users,
    title: 'Audience Personas',
    description: 'Get a 400-450 word professional profile describing exactly who your content should reach.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Insights',
    description: 'Gemini 2.0 Flash analyzes your answers to create actionable content strategies.',
  },
  {
    icon: FileText,
    title: 'Clear Deliverables',
    description: 'Receive structured profiles with target audience details and content responsibilities.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Focused',
    description: 'Every recommendation designed to attract, engage, and convert your ideal audience.',
  },
  {
    icon: MessageSquare,
    title: 'Content Strategy',
    description: 'Know what topics, formats, and CTAs will resonate with your specific listeners.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-royal-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything You Need to Know Your Audience
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Our comprehensive questionnaire system helps you build a complete picture of who you are creating content for.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-royal-600/50 hover:bg-white/10 transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-royal-800/50 flex items-center justify-center mb-4 group-hover:bg-royal-700/50 transition-colors">
                <feature.icon className="w-6 h-6 text-royal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
