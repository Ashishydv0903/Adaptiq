import React from 'react';

/**
 * Accessible Input with integrated Label, Helper text, and Error messaging
 */
export const Input = React.forwardRef(({
  id,
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  required = false,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-200 tracking-wide"
        >
          {label} {required && <span className="text-rose-400" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-xl">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-desc` : undefined}
          className={`w-full bg-[#0B192C] border ${
            error ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-500/20' : 'border-[#1B3A60] focus:border-[#52D68A] focus:ring-[#52D68A]/20'
          } rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium">
          <span aria-hidden="true">⚠️</span> {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-desc`} className="text-xs text-slate-400 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
