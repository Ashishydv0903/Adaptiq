import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Award,
  ShieldAlert,
  Quote,
  TrendingUp,
  Layers
} from 'lucide-react';

/**
 * Candidate-Friendly Explainable Feedback Modal
 * Simple, transparent, and grounded in direct answer evidence.
 */
export default function ExplainableFeedbackModal({
  isOpen,
  onClose,
  evaluation,
  question,
  candidateAnswer
}) {
  if (!isOpen || !evaluation) return null;

  const [showBenchmark, setShowBenchmark] = useState(false);

  const passedGate = evaluation.passedGate !== false && !evaluation.gateMessage;
  const gateMessage =
    evaluation.gateMessage ||
    'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.';

  const rawScore = evaluation.score ?? evaluation.finalScore ?? 75;
  const score = Math.round(rawScore <= 1.0 ? rawScore * 100 : rawScore);

  const confidence = evaluation.confidence || (passedGate ? (score >= 70 ? 'High' : 'Medium') : 'Low');
  const confidenceReason =
    evaluation.confidenceReason ||
    evaluation.reason ||
    (passedGate
      ? 'Candidate explained reasoning using technical concepts and structured logic.'
      : 'Answer did not meet basic relevance or completeness criteria.');

  const evidence =
    evaluation.evidence ||
    evaluation.evidenceExcerpt ||
    (passedGate ? 'Demonstrated key concepts in response.' : 'Insufficient evidence to assess.');

  // Answer Quality Checks
  const qualityChecks = evaluation.qualityChecks || {};
  const getQualityDisplay = (metric) => {
    if (metric && metric.score != null) {
      return `${Math.round(metric.score)}%`;
    }
    if (metric && metric.display) {
      return metric.display;
    }
    if (!passedGate) {
      return 'Insufficient evidence to assess.';
    }
    return 'Assessed';
  };

  const relevanceDisplay = getQualityDisplay(qualityChecks.relevance);
  const completenessDisplay = getQualityDisplay(qualityChecks.completeness);
  const clarityDisplay = getQualityDisplay(qualityChecks.clarity);
  const technicalDepthDisplay = getQualityDisplay(qualityChecks.technicalDepth);

  // Concepts covered / missing
  const covered =
    evaluation.conceptCoverage?.coveredConcepts ||
    evaluation.conceptCoverage?.concepts?.filter((c) => c.status === 'covered') ||
    [];
  const missing =
    evaluation.conceptCoverage?.missingConcepts ||
    evaluation.conceptCoverage?.concepts?.filter((c) => c.status !== 'covered') ||
    [];
  const suggestions = evaluation.counterfactuals || [];

  const myAnswer = candidateAnswer || evaluation.candidateAnswer || '';
  const ideal = question?.idealAnswer || evaluation.modelAnswerDiff?.idealAnswer || '';

  const getScoreMessage = (s) => {
    if (!passedGate) {
      return {
        text: 'Insufficient Evidence',
        color: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      };
    }
    if (s >= 85)
      return {
        text: 'Great Job!',
        color: 'text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      };
    if (s >= 70)
      return {
        text: 'Good Effort!',
        color: 'text-indigo-400',
        badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
      };
    if (s >= 50)
      return {
        text: 'On Track - Keep Practicing',
        color: 'text-amber-400',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      };
    return {
      text: 'Needs Practice',
      color: 'text-rose-400',
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
    };
  };

  const status = getScoreMessage(score);

  const getConceptName = (item) => {
    if (typeof item === 'string') return item;
    return item.concept || item.name || 'Key Concept';
  };

  const getConfidenceBadge = (conf) => {
    const c = String(conf || '').toLowerCase();
    if (c === 'high') {
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    }
    if (c === 'medium') {
      return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0F2238] border border-[#1B3A60] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#0B192C] border-b border-[#1B3A60] flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.badge}`}>
                {status.text}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getConfidenceBadge(
                  confidence
                )}`}
              >
                Confidence: {confidence}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Answer Assessment & Feedback
            </h2>
            <p className="text-xs text-slate-400 line-clamp-1">
              {question?.title || 'Question Performance Feedback'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#0F2238] border border-[#1B3A60] px-3.5 py-1.5 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Score</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#52D68A]">
                {passedGate ? score : 'N/A'}{' '}
                {passedGate && <span className="text-xs text-slate-400 font-sans font-normal">/ 100</span>}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition"
              aria-label="Close feedback"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-sm text-slate-200">
          {/* Answer Relevance Gate Alert (when gated) */}
          {!passedGate && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Answer Relevance Notice
                </h4>
                <p className="text-xs text-amber-200/95 leading-relaxed font-medium">
                  {gateMessage}
                </p>
                <p className="text-[11px] text-slate-400 pt-1">
                  To protect evaluation fairness, detailed competency scoring and feedback are withheld when an answer cannot be reliably connected to the question prompt.
                </p>
              </div>
            </div>
          )}

          {/* Answer Quality Checks Card */}
          <div className="p-4 rounded-2xl bg-[#0B192C]/70 border border-[#1B3A60] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4 text-[#52D68A]" />
                <span>Answer Quality Checks</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {passedGate ? 'Reliably Measured' : 'Quality Checks Restricted'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60]/60 text-center">
                <div className="text-[10px] uppercase text-slate-400 font-medium">Relevance</div>
                <div className={`text-sm font-bold mt-1 ${relevanceDisplay.includes('Insufficient') ? 'text-amber-400 text-xs' : 'text-white'}`}>
                  {relevanceDisplay}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60]/60 text-center">
                <div className="text-[10px] uppercase text-slate-400 font-medium">Completeness</div>
                <div className={`text-sm font-bold mt-1 ${completenessDisplay.includes('Insufficient') ? 'text-amber-400 text-xs' : 'text-white'}`}>
                  {completenessDisplay}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60]/60 text-center">
                <div className="text-[10px] uppercase text-slate-400 font-medium">Clarity</div>
                <div className={`text-sm font-bold mt-1 ${clarityDisplay.includes('Insufficient') ? 'text-amber-400 text-xs' : 'text-white'}`}>
                  {clarityDisplay}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60]/60 text-center">
                <div className="text-[10px] uppercase text-slate-400 font-medium">Technical Depth</div>
                <div className={`text-sm font-bold mt-1 ${technicalDepthDisplay.includes('Insufficient') ? 'text-amber-400 text-xs' : 'text-white'}`}>
                  {technicalDepthDisplay}
                </div>
              </div>
            </div>
          </div>

          {/* Confidence-based Evaluation & Evidence */}
          <div className="p-4 rounded-2xl bg-[#0B192C]/70 border border-[#1B3A60] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Evaluation Confidence & Evidence</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getConfidenceBadge(confidence)}`}>
                {confidence} Confidence
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-slate-400 font-semibold shrink-0">Reason:</span>
                <span className="text-slate-200">{confidenceReason}</span>
              </div>
              <div className="flex items-start gap-2 bg-[#0F2238] p-2.5 rounded-xl border border-[#1B3A60]/60">
                <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 text-[11px] block font-medium">Answer Evidence Excerpt:</span>
                  <span className="text-slate-300 italic">
                    {evidence === 'Insufficient evidence to assess.'
                      ? 'Insufficient evidence to assess.'
                      : `"${evidence}"`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Skill Cards (Only if passed gate) */}
          {passedGate ? (
            <>
              {/* Card 1: What You Did Well */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Strengths (What You Got Right)</span>
                </div>

                {covered.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-200">
                    {covered.slice(0, 4).map((item, idx) => {
                      const name = getConceptName(item);
                      const detail =
                        item.explanation && item.explanation.length > 5
                          ? item.explanation
                          : `Correctly applied in your solution.`;
                      return (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold mt-0.5">✅</span>
                          <span>
                            <strong className="text-white">{name}</strong> &mdash; {detail}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-300">
                    ✅ You provided a thoughtful response that addressed the basic prompt structure.
                  </p>
                )}
              </div>

              {/* Card 2: Key Points to Mention Next Time */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Needs Improvement (What Was Missing)</span>
                </div>

                {missing.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-200">
                    {missing.slice(0, 4).map((item, idx) => {
                      const name = getConceptName(item);
                      const detail =
                        item.explanation && item.explanation.length > 5
                          ? item.explanation
                          : `Explain this rule or trade-off to give a complete answer.`;
                      return (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold mt-0.5">⚠️</span>
                          <span>
                            <strong className="text-white">{name}</strong> &mdash; {detail}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-300">
                    You covered all the primary concepts requested in this prompt!
                  </p>
                )}
              </div>

              {/* Card 3: Quick Tip to Boost Score */}
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 flex-shrink-0" />
                  <span>What To Do Next</span>
                </div>

                {suggestions.length > 0 ? (
                  <div className="space-y-1.5">
                    {suggestions.slice(0, 3).map((sug, idx) => (
                      <div key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <span>
                          {sug.actionableSuggestion || sug.recommendation || `Remember to explain ${sug.concept}.`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>• Practice explaining solutions step-by-step</p>
                    <p>• Include real examples and concrete metrics</p>
                    <p>• Discuss tradeoffs and alternative approaches</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* When Gated: Candidate Guidance */
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-[#1B3A60] space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Lightbulb className="w-4 h-4 flex-shrink-0" />
                <span>What To Do Next</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>Directly address the specific engineering or behavioral question asked.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>Provide complete sentences explaining your reasoning rather than brief keywords or fragments.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>Include real-world examples, architecture decisions, and tradeoffs you considered.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Optional Sample Ideal Answer Toggle */}
          {ideal && (
            <div className="border border-[#1B3A60] rounded-2xl overflow-hidden bg-[#0B192C]/60">
              <button
                type="button"
                onClick={() => setShowBenchmark(!showBenchmark)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  View Sample Strong Answer
                </span>
                {showBenchmark ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showBenchmark && (
                <div className="p-4 pt-1 border-t border-[#1B3A60] text-xs text-slate-300 leading-relaxed space-y-3">
                  <div className="p-3 bg-[#0F2238] rounded-xl border border-[#1B3A60] text-slate-200">
                    {ideal}
                  </div>

                  {myAnswer && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        What You Wrote:
                      </span>
                      <div className="p-3 bg-[#0F2238]/60 rounded-xl border border-[#1B3A60] text-slate-300 font-mono text-[11px]">
                        {myAnswer}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#0B192C] border-t border-[#1B3A60] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-indigo-600/20"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
