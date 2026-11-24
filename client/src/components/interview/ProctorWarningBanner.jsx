import React from 'react';
import { AlertTriangle, ShieldAlert, XOctagon, CheckCircle2, X } from 'lucide-react';

/**
 * Candidate-Side Proctoring Warning Banner
 * Displays real-time warnings (yellow, orange, red) with escalation notices.
 */
export const ProctorWarningBanner = ({
  warning,
  onDismiss,
  counts = {},
  integrityScore = 100,
  integrityStatus = 'GREEN'
}) => {
  if (!warning) return null;

  const {
    severity = 'yellow',
    type = '',
    message = '',
    isEscalated,
    escalationReason,
    integrityScore: warningScore,
    integrityStatus: warningStatus
  } = warning;

  const currentScore = warningScore ?? integrityScore;
  const currentStatus = warningStatus ?? integrityStatus;

  const statusColors = {
    GREEN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    YELLOW: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    ORANGE: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    RED: 'bg-red-500/30 text-red-300 border-red-500/50'
  }[currentStatus] || 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  const config = {
    yellow: {
      border: 'border-amber-500/50',
      bg: 'bg-amber-950/80',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      title: 'Attention: Proctoring Advisory'
    },
    orange: {
      border: 'border-orange-500/60',
      bg: 'bg-orange-950/90',
      badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      icon: ShieldAlert,
      iconColor: 'text-orange-400',
      title: 'Warning: Proctoring Violation'
    },
    red: {
      border: 'border-red-500/70',
      bg: 'bg-red-950/95',
      badgeBg: 'bg-red-500/30 text-red-200 border-red-500/50',
      icon: XOctagon,
      iconColor: 'text-red-400 animate-pulse',
      title: 'CRITICAL: Assessment Integrity Flagged'
    }
  }[severity] || {
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/80',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    title: 'Proctoring Advisory'
  };

  const Icon = config.icon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl rounded-2xl border ${config.border} ${config.bg} p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
    >
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 p-2 rounded-xl bg-[#0B192C]/80 border border-slate-700/50">
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{config.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${config.badgeBg}`}>
                {severity}
              </span>
            </div>

            {severity !== 'red' && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                title="Dismiss warning"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {message}
          </p>

          {isEscalated && escalationReason && (
            <div className="mt-2 text-[11px] font-bold text-red-300 bg-red-900/40 px-2.5 py-1 rounded-lg border border-red-500/30 flex items-center gap-1.5">
              <span>⚠️ Escalation Notice:</span>
              <span>{escalationReason}</span>
            </div>
          )}

          {/* AI-Generated-Text Risk Indicator Notice (Labelled as risk indicator only) */}
          {type === 'AI_TEXT_RISK_INDICATOR' && (
            <div className="mt-2 text-[10px] bg-slate-900/80 border border-slate-700/60 p-2 rounded-lg text-slate-300">
              <span className="font-semibold text-amber-300 block mb-0.5">
                AI Risk Indicator (Review Flag Only)
              </span>
              <span>
                Stylometric burstiness and model heuristics flagged potential synthetic text markers.
                This is an indicator only and does not constitute definitive proof.
              </span>
            </div>
          )}

          {/* Status, Score & Infraction Trackers */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-mono border-t border-slate-800/80 mt-2">
            <div className="flex items-center gap-2">
              <span>Integrity Status:</span>
              <span className={`px-2 py-0.5 rounded-full border font-bold text-[9px] ${statusColors}`}>
                {currentStatus} ({currentScore}/100)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-amber-400">Y: {counts.yellow ?? 0}</span>
              <span>•</span>
              <span className="text-orange-400">O: {counts.orange ?? 0}</span>
              <span>•</span>
              <span className="text-red-400">R: {counts.red ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProctorWarningBanner;
