import React from 'react';
import { Lightbulb, ArrowUpRight, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

/**
 * Counterfactual Suggestions View
 * Displays actionable "What-If" recommendations simulated across missing key concepts
 *
 * @param {Object} props
 * @param {Array<Object>} props.counterfactuals
 * @param {number} props.currentScore
 */
export default function CounterfactualSuggestionsView({ counterfactuals = [], currentScore = 50 }) {
  if (!counterfactuals || counterfactuals.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-2">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-white">Full Concept Mastery Achieved</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your response successfully addressed all core architectural concepts. No counterfactual missing concept simulations required!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Actionable Counterfactual Suggestions
            </h3>
            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              What-If Simulation
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulates the exact marginal score improvement if you incorporated each missing concept.
          </p>
        </div>

        <span className="text-xs text-slate-400">
          Sorted by Highest Score Leverage
        </span>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {counterfactuals.map((cf, idx) => (
          <div
            key={idx}
            className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40 transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                  {cf.concept || cf.dimension}
                </span>

                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-0.5 shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  +{cf.potentialGain} pts
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {cf.recommendation}
              </p>
            </div>

            {/* Score Projection Footer */}
            <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>Projected Score:</span>
              </div>
              <div className="font-mono">
                <span className="text-slate-400">{cf.currentScore ?? currentScore}</span>
                <span className="text-slate-500 mx-1">→</span>
                <strong className="text-emerald-400 font-bold">{cf.simulatedScore} / 100</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
