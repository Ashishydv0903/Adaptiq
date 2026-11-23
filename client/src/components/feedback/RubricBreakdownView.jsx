import React from 'react';
import { Check, Quote, ShieldCheck, Scale, Zap } from 'lucide-react';

/**
 * Rubric Breakdown View
 * Displays detailed scores, justifications, evidence quotes, and 3-run consensus variance
 * for Correctness, Depth, Clarity, Completeness, and Relevance.
 *
 * @param {Object} props
 * @param {Object} props.rubric
 */
export default function RubricBreakdownView({ rubric }) {
  if (!rubric || !rubric.scores) {
    return null;
  }

  const {
    scores = {},
    details = {},
    variance = 0,
    runCount = 3
  } = rubric;

  const criteriaList = [
    { key: 'correctness', label: 'Correctness', desc: 'Factual accuracy, logic, best practices' },
    { key: 'depth', label: 'Depth', desc: 'Architectural insight, internals, trade-offs' },
    { key: 'clarity', label: 'Clarity', desc: 'Readability, terminology, communication flow' },
    { key: 'completeness', label: 'Completeness', desc: 'Addressing all core facets and edge cases' },
    { key: 'relevance', label: 'Relevance', desc: 'Direct focus on prompt without divergence' }
  ];

  const getScoreColor = (score) => {
    if (score >= 8.5) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 7.0) return 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
    if (score >= 5.0) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const getProgressBarColor = (score) => {
    if (score >= 8.5) return 'bg-emerald-500';
    if (score >= 7.0) return 'bg-cyan-500';
    if (score >= 5.0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Objective Rubric Assessment (5 Dimensions)
            </h3>
            <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-medium">
              Median of 3 Runs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluated at temperature 0 across 3 independent passes to eliminate hallucination variance.
          </p>
        </div>

        {/* Consistency Metric */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <Scale className="w-4 h-4 text-indigo-400" />
          <div className="text-left">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Pass Variance</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {Number(variance).toFixed(4)} {variance === 0 ? '(High Agreement)' : '(Consistent)'}
            </span>
          </div>
        </div>
      </div>

      {/* Criteria Cards */}
      <div className="space-y-4">
        {criteriaList.map((crit) => {
          const score = scores[crit.key] ?? 5.0;
          const detail = details[crit.key] || {};
          const quotes = detail.evidenceQuotes || [];
          const verifiedQuotes = detail.verifiedQuotes || [];

          return (
            <div
              key={crit.key}
              className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-100 text-sm">{crit.label}</h4>
                    <span className="text-xs text-slate-400">· {crit.desc}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress Bar */}
                  <div className="w-24 sm:w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressBarColor(score)} transition-all duration-500`}
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-mono font-bold ${getScoreColor(score)}`}>
                    {score.toFixed(1)} / 10
                  </span>
                </div>
              </div>

              {/* Justification Text */}
              {detail.justification && (
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/50">
                  {detail.justification}
                </p>
              )}

              {/* Evidence Quotes */}
              {quotes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Quote className="w-3 h-3 text-slate-500" />
                    Cited Evidence from Candidate Answer:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quotes.map((q, idx) => {
                      const isVerified = verifiedQuotes.includes(q);
                      return (
                        <div
                          key={idx}
                          className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                            isVerified
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {isVerified && <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />}
                          <span className="italic">"{q}"</span>
                          {isVerified && (
                            <span className="text-[9px] text-emerald-400/80 font-mono ml-1 uppercase">verified</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
