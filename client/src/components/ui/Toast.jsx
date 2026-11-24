import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Accessible Toast Component with aria-live support
 */
export const Toast = ({
  id,
  type = 'info',
  title,
  message,
  onDismiss,
  duration = 5000
}) => {
  useEffect(() => {
    if (!duration || !onDismiss) return;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
  };

  const borderStyles = {
    success: 'border-emerald-500/40 bg-[#0F2238]',
    error: 'border-rose-500/40 bg-[#0F2238]',
    warning: 'border-amber-500/40 bg-[#0F2238]',
    info: 'border-sky-500/40 bg-[#0F2238]'
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-4 rounded-2xl border shadow-xl flex items-start gap-3 w-full max-w-sm transition-all animate-fade-in ${borderStyles[type] || borderStyles.info}`}
    >
      {icons[type] || icons.info}
      <div className="flex-1 space-y-0.5">
        {title && <h4 className="text-xs font-bold text-white tracking-wide">{title}</h4>}
        <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(id)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default Toast;
