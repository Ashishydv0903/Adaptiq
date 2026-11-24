import React from 'react';
import { Shield, LogOut } from 'lucide-react';

export const InterviewHeader = ({
  session,
  isProctoringActive,
  onExitClick
}) => {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-[#1B3A60] bg-[#0B192C]/90 backdrop-blur sticky top-0 z-30 pt-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#52D68A]" />
          <span className="text-sm font-bold text-white tracking-tight">
            {session?.targetRole || 'AdaptIQ Technical Interview'}
          </span>
        </div>
        {isProctoringActive && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
            ● Continuous Proctoring
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onExitClick}
          className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          id="exit-interview-header-btn"
          title="Exit interview session"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Exit Interview</span>
        </button>
      </div>
    </div>
  );
};

export default InterviewHeader;
