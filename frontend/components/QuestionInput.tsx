'use client';

import { useState } from 'react';
import { Question } from '@/lib/types';

interface QuestionInputProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}

export default function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  const baseInputClass = `
    w-full px-4 py-3 rounded-xl 
    bg-white/5 border border-white/10 
    text-white placeholder-gray-500
    focus:border-royal-500 focus:ring-2 focus:ring-royal-500/20
    transition-all duration-200
  `;

  switch (question.type) {
    case 'textarea':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {question.label}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {question.helpText && (
            <p className="text-sm text-gray-500">{question.helpText}</p>
          )}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            rows={4}
            className={`${baseInputClass} resize-none`}
          />
        </div>
      );

    case 'radio':
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            {question.label}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {question.helpText && (
            <p className="text-sm text-gray-500">{question.helpText}</p>
          )}
          <div className="space-y-2">
            {question.options?.map((option) => (
              <label
                key={option}
                className={`
                  flex items-center p-4 rounded-xl border cursor-pointer
                  transition-all duration-200
                  ${value === option 
                    ? 'border-royal-500 bg-royal-500/10' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }
                `}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(e.target.value)}
                  required={question.required}
                  className="w-4 h-4 text-royal-500 border-white/30 focus:ring-royal-500 focus:ring-offset-0"
                />
                <span className="ml-3 text-white">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {question.label}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {question.helpText && (
            <p className="text-sm text-gray-500">{question.helpText}</p>
          )}
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={question.required}
            className={`${baseInputClass} appearance-none cursor-pointer`}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              backgroundSize: '1.5rem',
            }}
          >
            <option value="" disabled>Select an option</option>
            {question.options?.map((option) => (
              <option key={option} value={option} className="bg-royal-900 text-white">
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    default: // text
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {question.label}
            {question.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {question.helpText && (
            <p className="text-sm text-gray-500">{question.helpText}</p>
          )}
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            className={baseInputClass}
          />
        </div>
      );
  }
}
