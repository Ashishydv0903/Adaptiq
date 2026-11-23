import React from 'react';
import { TrendingUp, Activity, ShieldCheck } from 'lucide-react';

export const AbilityMeter = ({ theta = 0.0, sem = 1.0, percentile = 50.0, isLive = false }) => {
  // Normalize theta [-4.0, +4.0] to percentage [0, 100%]
  const normalizedPercentage = Math.max(0, Math.min(100, ((theta + 4) / 8) * 100));

  // Confidence Interval band: [theta - sem, theta + sem]
  const lowerTheta = Math.max(-4.0, theta - sem);
  const upperTheta = Math.min(4.0, theta + sem);
  const lowerPercentage = Math.max(0, ((lowerTheta + 4) / 8) * 100);
  const upperPercentage = Math.min(100, ((upperTheta + 4) / 8) * 100);
  const ciWidth = Math.max(4, upperPercentage - lowerPercentage);

  const getTier = (val) => {
    if (val >= 2.0) return { label: 'Master', color: 'text-[#52D68A]', bg: 'bg-[#52D68A]/10 border-[#52D68A]/30' };
    if (val >= 1.0) return { label: 'Proficient', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' };
    if (val >= 0.0) return { label: 'Competent', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (val >= -1.5) return { label: 'Developing', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { label: 'Novice', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  };

  const tier = getTier(theta);

  return (
    <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-4 shadow-xl space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#52D68A]/10 border border-[#52D68A]/20 flex items-center justify-center text-[#52D68A]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Live Skill Score
              </span>
              {isLive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#52D68A]/15 text-[#52D68A] border border-[#52D68A]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#52D68A] animate-ping"></span> Live Updates
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">Adapts automatically as you submit answers</span>
          </div>
        </div>

        {/* Tier badge */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tier.bg} ${tier.color}`}>
          {tier.label} Level
        </span>
      </div>

      {/* Metrics Row in Plain English */}
      <div className="grid grid-cols-3 gap-2 py-1 text-center">
        <div className="bg-[#0B192C] rounded-xl p-2 border border-[#1B3A60]">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Current Rating</div>
          <div className="text-base sm:text-lg font-mono font-bold text-white">
            {Math.round(normalizedPercentage)}%
          </div>
        </div>

        <div className="bg-[#0B192C] rounded-xl p-2 border border-[#1B3A60]">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Score Precision</div>
          <div className="text-base sm:text-lg font-mono font-bold text-[#52D68A]">
            {sem <= 0.35 ? 'High (±3%)' : sem <= 0.6 ? 'Moderate' : 'Calibrating'}
          </div>
        </div>

        <div className="bg-[#0B192C] rounded-xl p-2 border border-[#1B3A60]">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Class Standing</div>
          <div className="text-base sm:text-lg font-mono font-bold text-amber-300">
            Top {Math.max(1, Math.round(100 - percentile))}%
          </div>
        </div>
      </div>

      {/* Visual Ability Gauge with Confidence Band */}
      <div className="space-y-1.5 pt-1">
        <div className="relative h-3 w-full bg-[#0B192C] rounded-full overflow-hidden border border-[#1B3A60]">
          {/* Background gradient track */}
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-[#52D68A]/30"></div>

          {/* Confidence interval band */}
          <div
            className="absolute top-0 bottom-0 bg-[#52D68A]/30 border-l border-r border-[#52D68A] transition-all duration-500"
            style={{ left: `${lowerPercentage}%`, width: `${ciWidth}%` }}
            title={`Estimated range: ${Math.round(lowerPercentage)}% - ${Math.round(upperPercentage)}%`}
          ></div>

          {/* Ability Needle marker */}
          <div
            className="absolute top-0 bottom-0 w-2.5 bg-indigo-400 rounded-full shadow-lg shadow-indigo-500/50 -ml-1 transition-all duration-500"
            style={{ left: `${normalizedPercentage}%` }}
          ></div>
        </div>

        {/* Axis labels in plain English */}
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>Beginner</span>
          <span>Intermediate</span>
          <span>Proficient</span>
          <span>Expert</span>
        </div>
      </div>
    </div>
  );
};

export default AbilityMeter;
