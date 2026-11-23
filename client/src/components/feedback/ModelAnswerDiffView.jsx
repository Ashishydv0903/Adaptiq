import React, { useState } from 'react';
import { Columns, Eye, Check, X, BookOpen, User } from 'lucide-react';

/**
 * Model-Answer Side-by-Side Diff View
 * Renders candidate's submitted response alongside the benchmark ideal answer,
 * annotating matched concepts and omissions.
 *
 * @param {Object} props
 * @param {Object} props.diffData - Structured diff output
 * @param {string} props.candidateAnswer
 * @param {string} props.idealAnswer
 */
export default function ModelAnswerDiffView({ diffData, candidateAnswer, idealAnswer }) {
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'candidate' | 'ideal'

  const actualCandidate = candidateAnswer || diffData?.candidateAnswer || 'No candidate response recorded.';
  const actualIdeal = idealAnswer || diffData?.idealAnswer || 'Benchmark ideal answer not available.';
  const conceptComparison = diffData?.conceptComparison || { matched: [], partiallyMatched: [], omitted: [] };
  const wordCount = diffData?.wordCount || {
    candidate: actualCandidate.split(/\s+/).length,
    ideal: actualIdeal.split(/\s+/).length,
    ratio: 1.0
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Model-Answer Side-by-Side Diff
            </h3>
            <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-medium">
              Benchmark Comparison
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare your response directly against the engineering benchmark answer and key patterns.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('split')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'split' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setActiveTab('candidate')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'candidate' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Your Answer
          </button>
          <button
            onClick={() => setActiveTab('ideal')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'ideal' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Benchmark
          </button>
        </div>
      </div>

      {/* Matched vs Omitted Concept Pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {conceptComparison.matched.map((c, i) => (
          <span
            key={`m-${i}`}
            className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1"
          >
            <Check className="w-3 h-3 text-emerald-400" />
            {c}
          </span>
        ))}
        {conceptComparison.partiallyMatched.map((c, i) => (
          <span
            key={`p-${i}`}
            className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1"
          >
            ~ {c}
          </span>
        ))}
        {conceptComparison.omitted.map((c, i) => (
          <span
            key={`o-${i}`}
            className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-1"
          >
            <X className="w-3 h-3 text-rose-400" />
            {c}
          </span>
        ))}
      </div>

      {/* Side-by-Side Diff Comparison Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Candidate Answer */}
        {(activeTab === 'split' || activeTab === 'candidate') && (
          <div className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Candidate Submission
              </span>
              <span className="text-slate-400 font-mono text-[11px]">{wordCount.candidate} words</span>
            </div>
            <div className="p-4 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap select-text h-72 overflow-y-auto">
              {actualCandidate}
            </div>
          </div>
        )}

        {/* Right Column: Benchmark Model Answer */}
        {(activeTab === 'split' || activeTab === 'ideal') && (
          <div className="flex flex-col bg-slate-950/70 border border-emerald-500/20 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                Benchmark Model Answer
              </span>
              <span className="text-emerald-400/80 font-mono text-[11px]">{wordCount.ideal} words</span>
            </div>
            <div className="p-4 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap select-text h-72 overflow-y-auto bg-emerald-950/5">
              {actualIdeal}
            </div>
          </div>
        )}
      </div>

      {diffData?.summary && (
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <span>{diffData.summary}</span>
          <span className="text-slate-500 font-mono">Length Ratio: {wordCount.ratio}x</span>
        </div>
      )}
    </div>
  );
}
