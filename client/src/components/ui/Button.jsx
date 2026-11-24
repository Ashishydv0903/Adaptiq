import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Accessible Button Component
 * Supports variants: primary (mint), secondary (navy), outline, ghost, danger
 * Sizes: sm, md, lg
 */
export const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  leftIcon,
  rightIcon,
  type = 'button',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52D68A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B192C] disabled:opacity-50 disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-[#52D68A] text-[#0B192C] hover:bg-[#42C378] active:bg-[#34B56A] shadow-sm font-bold',
    secondary: 'bg-[#0F2238] text-white hover:bg-[#1B3A60] border border-[#1B3A60] hover:border-[#52D68A]/40',
    outline: 'bg-transparent text-slate-200 hover:text-white border border-[#1B3A60] hover:border-[#52D68A] hover:bg-[#52D68A]/10',
    ghost: 'bg-transparent text-slate-300 hover:text-white hover:bg-[#0F2238]',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-500/50'
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm px-4 py-2 rounded-xl gap-2',
    lg: 'text-base px-6 py-3 rounded-2xl gap-2.5'
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : leftIcon ? (
        <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
