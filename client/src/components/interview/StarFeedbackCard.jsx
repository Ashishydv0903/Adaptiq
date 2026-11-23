import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Sparkles,
  Quote
} from 'lucide-react';

/**
 * Student-Friendly STAR Behavioral Feedback Card
 * Visualizes Situation, Task, Action, Result breakdown in clean, simple plain English.
 */
export default function StarFeedbackCard({ starEvaluation }) {
  if (!starEvaluation) return null;

  const {
    situation = {},
    task = {},
    action = {},
    result = {},
    overallScore = 75,
    missingComponents = [],
    coachingTip = ''
  } = starEvaluation;

  const components = [
    { key: 'situation', letter: 'S', title: 'Situation', subtitle: 'The Background & Challenge', data: situation },
    { key: 'task', letter: 'T', title: 'Task', subtitle: 'Your Specific Goal', data: task },
    { key: 'action', letter: 'A', title: 'Action', subtitle: 'Steps You Personally Took', data: action },
    { key: 'result', letter: 'R', title: 'Result', subtitle: 'The Final Outcome & Impact', data: result }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Friendly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              How Your Story Scored (STAR Format)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Storytelling Check
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Top candidates tell stories by sharing the <strong>Situation</strong>, <strong>Task</strong>, <strong>Action</strong>, and <strong>Result</strong>.
          </p>
        </div>

        <div className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 text-right shrink-0">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Story Score</span>
          <span className="text-base font-bold text-emerald-400 font-mono">{overallScore} / 100</span>
        </div>
      </div>

      {/* Gentle missing part reminder */}
      {missingComponents.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Quick tip:</strong> Next time, be sure to highlight the{' '}
            <span className="font-bold underline text-amber-300">{missingComponents.join(' and ')}</span> in your story.
          </div>
        </div>
      )}

      {/* 4 Pillars Grid - Simple & Readable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {components.map((comp) => {
          const isPresent = comp.data.present;

          return (
            <div
              key={comp.key}
              className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                isPresent
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPresent
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {comp.letter}
                  </span>
                  <div>
                    <span className="font-bold text-xs text-white block">{comp.title}</span>
                    <span className="text-[10px] text-slate-400 block">{comp.subtitle}</span>
                  </div>
                </div>

                {isPresent ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 bg-slate-900 rounded">
                    Skipped
                  </span>
                )}
              </div>

              {comp.data.feedback && (
                <p className="text-xs text-slate-300 leading-snug">
                  {comp.data.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Coaching Tip in Everyday English */}
      {coachingTip && (
        <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-start gap-2.5 text-xs text-indigo-200">
          <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold mb-0.5">Tip for your next interview:</strong>
            {coachingTip}
          </div>
        </div>
      )}
    </div>
  );
}
