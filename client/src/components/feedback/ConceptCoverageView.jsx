import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Quote, Sparkles, Compass } from 'lucide-react';

/**
 * Concept-Coverage Detection View
 * Highlights expected concepts, displays evidence quotes verified from candidate text,
 * and shows semantic vector embedding similarity.
 *
 * @param {Object} props
 * @param {Object} props.conceptCoverage
 */
export default function ConceptCoverageView({ conceptCoverage }) {
  if (!conceptCoverage || !conceptCoverage.concepts) {
    return null;
  }

  const {
    concepts = [],
    coverageRatio = 0,
    coveredCount = 0,
    partiallyCoveredCount = 0,
    missingCount = 0,
    totalConcepts = 0,
    semanticSimilarity = 0
  } = conceptCoverage;

  const coveragePercent = Math.round(coverageRatio * 100);
  const similarityPercent = Math.round(semanticSimilarity * 100);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Key Concept Coverage & Semantic Matching
            </h3>
            <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-medium">
              Embedding + LLM Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates whether critical architectural concepts and algorithmic patterns were articulated in your response.
          </p>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Coverage</span>
            <span className="text-base font-bold text-emerald-400">{coveragePercent}%</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Semantic Cosine</span>
            <span className="text-base font-bold text-cyan-400">{similarityPercent}%</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            {coveredCount} Covered · {partiallyCoveredCount} Partial · {missingCount} Missing of {totalConcepts} Concepts
          </span>
          <span className="font-semibold text-slate-300">{coveragePercent}% Match</span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(coveredCount / totalConcepts) * 100}%` }}
            title="Covered Concepts"
          />
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${(partiallyCoveredCount / totalConcepts) * 100}%` }}
            title="Partially Covered Concepts"
          />
          <div
            className="h-full bg-rose-500/50 transition-all duration-500"
            style={{ width: `${(missingCount / totalConcepts) * 100}%` }}
            title="Missing Concepts"
          />
        </div>
      </div>

      {/* Concept Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {concepts.map((item, idx) => {
          const isCovered = item.status === 'covered';
          const isPartial = item.status === 'partially_covered';
          const isMissing = item.status === 'missing';

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all duration-200 ${
                isCovered
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : isPartial
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isCovered && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {isPartial && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {isMissing && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span className="font-semibold text-sm text-white">{item.concept}</span>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 ${
                    isCovered
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : isPartial
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {isCovered ? 'Covered' : isPartial ? 'Partial' : 'Missing'}
                </span>
              </div>

              {/* Explanation */}
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {item.explanation}
              </p>

              {/* Evidence Quote if present */}
              {item.evidenceQuote && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Quote className="w-3 h-3 text-slate-500" />
                      Candidate Evidence Quote:
                    </span>
                    {item.isQuoteVerified ? (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                        ✓ Verified in text
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Semantic inference</span>
                    )}
                  </div>
                  <p className="italic text-slate-200">"{item.evidenceQuote}"</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
