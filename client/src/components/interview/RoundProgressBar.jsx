import React from 'react';
import { Check, CircleDot, Clock, Layers } from 'lucide-react';

/**
 * Multi-Round Visual Stepper & Progress Bar
 *
 * @param {Object} props
 * @param {Array<Object>} props.rounds - Array of round configurations
 * @param {number} props.currentRoundIndex - Active round index (0-based)
 * @param {string} props.currentRoundType - Active round type
 */
export default function RoundProgressBar({
  rounds = [],
  currentRoundIndex = 0,
  currentRoundType = 'mcq'
}) {
  if (!rounds || rounds.length === 0) return null;

  const roundTypeLabels = {
    mcq: 'MCQ Screening',
    technical: 'Technical Depth',
    coding: 'Coding Challenge',
    system_design: 'System Design',
    behavioral: 'Behavioral (STAR)',
    hr: 'Culture & HR'
  };

  const activeRound = rounds[currentRoundIndex] || rounds[0];

  return (
    <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-4 shadow-lg space-y-3">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#52D68A]" />
          <span className="font-semibold text-slate-200">
            Round {currentRoundIndex + 1} of {rounds.length}:
          </span>
          <span className="font-bold text-[#52D68A] bg-[#52D68A]/15 px-2.5 py-0.5 rounded-full border border-[#52D68A]/30">
            {activeRound?.label || roundTypeLabels[activeRound?.roundType] || activeRound?.roundType}
          </span>
        </div>

        <div className="text-slate-300">
          Target:{' '}
          <span className="font-mono text-white font-semibold">
            {activeRound?.completedQuestions || 0} / {activeRound?.targetQuestions || 2} questions
          </span>
        </div>
      </div>

      {/* Stepper Dots & Connector Line */}
      <div className="relative flex items-center justify-between pt-1">
        {/* Background connector line */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1 bg-[#1B3A60] -z-0 rounded-full" />

        {rounds.map((r, idx) => {
          const isCompleted = idx < currentRoundIndex || r.status === 'completed';
          const isActive = idx === currentRoundIndex;
          const isPending = idx > currentRoundIndex && !isCompleted;

          const roundName = r.label || roundTypeLabels[r.roundType] || r.roundType;
          const shortName = roundName.split(' ')[0];

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                  isCompleted
                    ? 'bg-emerald-400 text-[#0B192C] ring-2 ring-emerald-400/40'
                    : isActive
                    ? 'bg-[#52D68A] text-[#0B192C] ring-4 ring-[#52D68A]/30 font-extrabold animate-pulse'
                    : 'bg-[#0B192C] text-slate-400 border border-[#1B3A60]'
                }`}
                title={roundName}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : isActive ? (
                  <CircleDot className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Sub-label for larger screens */}
              <span
                className={`text-[10px] mt-1.5 font-medium hidden sm:block max-w-[70px] truncate text-center ${
                  isActive
                    ? 'text-[#52D68A] font-bold'
                    : isCompleted
                    ? 'text-emerald-400 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {shortName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
