import React from 'react';
import { Pause, Play } from 'lucide-react';

export const InterviewPausedModal = ({
  isPaused,
  remainingSeconds,
  onResume
}) => {
  if (!isPaused) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paused-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
        <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <Pause className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h3 id="paused-modal-title" className="text-xl font-bold text-white tracking-tight">
            Assessment Paused
          </h3>
          <p className="text-xs text-slate-400">
            Your question timer is safely frozen on the server at{' '}
            <strong className="text-white font-mono">{remainingSeconds}s</strong> remaining.
          </p>
        </div>

        <div className="p-3 bg-[#0B192C] rounded-xl border border-[#1B3A60] text-xs text-slate-300">
          You can resume now, or return from your dashboard whenever you are ready.
        </div>

        <button
          onClick={onResume}
          className="w-full py-3 bg-[#52D68A] hover:bg-[#42C378] text-[#0B192C] text-sm font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 transition flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" /> Resume Assessment
        </button>
      </div>
    </div>
  );
};

export default InterviewPausedModal;
