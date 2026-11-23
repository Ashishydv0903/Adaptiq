import React, { useState } from 'react';
import {
  Sparkles,
  HelpCircle,
  CornerDownRight,
  Send,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

/**
 * Interactive Conversational Follow-Up Card
 *
 * @param {Object} props
 * @param {Object} props.followUp - The follow-up object from LLM generator
 * @param {Function} props.onSubmit - Callback when candidate submits follow-up answer
 * @param {Function} props.onSkip - Callback to bypass follow-up and move to next question
 * @param {boolean} props.submitting - Loading state
 */
export default function FollowUpCard({
  followUp,
  onSubmit,
  onSkip,
  submitting = false
}) {
  const [followUpAnswer, setFollowUpAnswer] = useState('');

  if (!followUp || !followUp.shouldFollowUp) return null;

  const typeConfig = {
    clarify: {
      label: 'Quick Clarification',
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: HelpCircle
    },
    go_deeper: {
      label: 'Go a Bit Deeper',
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: Cpu
    },
    edge_case: {
      label: 'Edge Cases & Gotchas',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: ShieldAlert
    },
    real_world_example: {
      label: 'Real-World Example',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: TrendingUp
    },
    trade_off: {
      label: 'Trade-Offs & Alternatives',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Sparkles
    }
  };

  const config = typeConfig[followUp.type] || typeConfig.edge_case;
  const TypeIcon = config.icon;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!followUpAnswer.trim()) return;
    onSubmit(followUpAnswer);
    setFollowUpAnswer('');
  };

  return (
    <div className="bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Follow-Up Question #{followUp.followUpIndex || 1} of {followUp.maxAllowed || 2}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${config.badge}`}>
            <TypeIcon className="w-3 h-3" />
            {config.label}
          </span>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">Practice Bonus</span>
      </div>

      {/* Follow-up Prompt */}
      <div className="space-y-2">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
          {followUp.followUpPrompt}
        </h3>

        {followUp.contextRationale && (
          <p className="text-xs text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800 leading-relaxed">
            <strong className="text-slate-300">Why the interviewer asks this:</strong> {followUp.contextRationale}
          </p>
        )}
      </div>

      {/* Answer Form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <textarea
          rows={4}
          value={followUpAnswer}
          onChange={(e) => setFollowUpAnswer(e.target.value)}
          placeholder="Address the follow-up question here with technical detail..."
          className="w-full bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition font-sans leading-relaxed"
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            className="text-xs text-slate-400 hover:text-slate-200 transition font-medium"
          >
            Skip Follow-Up & Continue →
          </button>

          <button
            type="submit"
            disabled={submitting || !followUpAnswer.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Submit Follow-Up <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
