import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/**
 * Standard Error State Component with Retry Action
 */
export const ErrorState = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while loading this section. Please try again.',
  onRetry,
  className = ''
}) => {
  return (
    <div
      className={`p-8 sm:p-12 text-center bg-rose-500/5 border border-rose-500/20 rounded-2xl flex flex-col items-center justify-center space-y-4 ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>

      <div className="max-w-md space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-rose-200 tracking-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {message}
        </p>
      </div>

      {onRetry && (
        <div className="pt-2">
          <Button
            variant="secondary"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};

export default ErrorState;
