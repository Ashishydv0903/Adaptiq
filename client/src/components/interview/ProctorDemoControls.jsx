import React from 'react';
import { Smartphone, Users, UserX, FlaskConical } from 'lucide-react';

/**
 * ProctorDemoControls
 * Floating test panel visible strictly when VITE_DEMO_MODE === 'true' (for viva fallback/demonstrations).
 * Injects simulated violations carrying source: 'demo'.
 */
export const ProctorDemoControls = ({ onInjectEvent }) => {
  // Visible when VITE_DEMO_MODE === 'true' or in demo/testing query mode (persisted across session)
  const hasQueryDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true');
  if (hasQueryDemo && typeof window !== 'undefined') {
    try {
      localStorage.setItem('adaptiq_demo_mode', 'true');
      sessionStorage.setItem('adaptiq_demo_mode', 'true');
    } catch {}
  }

  const isDemoActive =
    typeof window !== 'undefined' &&
    (import.meta.env.VITE_DEMO_MODE === 'true' ||
      window.__DEMO_MODE__ === true ||
      hasQueryDemo ||
      sessionStorage.getItem('adaptiq_demo_mode') === 'true' ||
      localStorage.getItem('adaptiq_demo_mode') === 'true');

  if (!isDemoActive) {
    return null;
  }

  return (
    <div
      data-testid="proctor-demo-controls"
      className="fixed bottom-4 left-4 z-50 bg-[#0B192C]/95 border-2 border-purple-500/70 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs animate-in fade-in"
    >
      <div className="flex items-center gap-1.5 mb-2 border-b border-purple-500/30 pb-1.5">
        <FlaskConical className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
          Viva Demo Controls
        </span>
        <span className="ml-auto px-1.5 py-0.2 text-[9px] font-black bg-purple-900/80 text-purple-200 border border-purple-400/50 rounded">
          SIMULATED
        </span>
      </div>

      <p className="text-[10px] text-slate-300 mb-2.5">
        Inject test events to verify proctor escalation and recruiter alerts:
      </p>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onInjectEvent?.('phone')}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-200 rounded-lg text-xs font-semibold transition active:scale-95 text-left"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span>Inject Phone (Prohibited Object)</span>
        </button>

        <button
          type="button"
          onClick={() => onInjectEvent?.('second_face')}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-200 rounded-lg text-xs font-semibold transition active:scale-95 text-left"
        >
          <Users className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span>Inject 2nd Face (Multiple Faces)</span>
        </button>

        <button
          type="button"
          onClick={() => onInjectEvent?.('identity_mismatch')}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-200 rounded-lg text-xs font-semibold transition active:scale-95 text-left"
        >
          <UserX className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span>Inject Identity Mismatch</span>
        </button>
      </div>
    </div>
  );
};

export default ProctorDemoControls;
