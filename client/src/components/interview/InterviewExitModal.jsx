import React from 'react';
import { AlertTriangle, LogOut, ArrowRight } from 'lucide-react';

export const InterviewExitModal = ({
  isOpen,
  isExiting,
  onClose,
  onConfirmExit
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <h3 id="exit-modal-title" className="text-xl font-bold text-white tracking-tight">
            Exit Interview Early?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Are you sure you want to exit now? We will save your completed responses, compile your partial scorecard, and securely archive your proctoring logs.
          </p>
        </div>

        <div className="p-3.5 bg-[#0B192C] rounded-2xl border border-[#1B3A60] text-xs text-slate-300 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-white font-semibold">
            <span>✓</span> Completed responses will be scored
          </div>
          <div className="flex items-center gap-2 text-white font-semibold">
            <span>✓</span> Partial scorecard &amp; feedback generated
          </div>
          <div className="flex items-center gap-2 text-white font-semibold">
            <span>✓</span> Proctoring audit logs securely preserved
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isExiting}
            className="w-full sm:flex-1 py-2.5 px-4 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] transition cursor-pointer"
          >
            Continue Interview
          </button>

          <button
            type="button"
            onClick={onConfirmExit}
            disabled={isExiting}
            className="w-full sm:flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
            id="confirm-end-interview-btn"
          >
            {isExiting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>End Interview</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewExitModal;
