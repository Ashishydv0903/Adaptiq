import React from 'react';

/**
 * Accessible Badge Component
 * Variants: default, success, warning, danger, neutral, outline
 */
export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
  ...props
}) => {
  const base = 'inline-flex items-center font-semibold rounded-full border transition-colors select-none';

  const variants = {
    default: 'bg-[#52D68A]/15 text-[#52D68A] border-[#52D68A]/30',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
    outline: 'bg-transparent text-slate-300 border-[#1B3A60]'
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-sm px-3.5 py-1 gap-2'
  };

  return (
    <span className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`} {...props}>
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
