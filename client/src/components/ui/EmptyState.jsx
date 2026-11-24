import React from 'react';
import { Compass } from 'lucide-react';
import { Button } from './Button';

/**
 * Standard Empty State Component with Call to Action
 */
export const EmptyState = ({
  icon,
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`p-10 sm:p-14 text-center bg-[#0F2238] border border-[#1B3A60] rounded-2xl flex flex-col items-center justify-center space-y-4 ${className}`}
      role="region"
      aria-label={title}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#52D68A]/10 border border-[#52D68A]/20 flex items-center justify-center text-[#52D68A]">
        {icon || <Compass className="w-7 h-7" aria-hidden="true" />}
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
