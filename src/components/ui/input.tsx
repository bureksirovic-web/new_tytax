'use client';
import { forwardRef, useId, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy = [props['aria-describedby'], error ? errorId : hint ? hintId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="font-display text-xs font-medium uppercase tracking-wider text-fg-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              min-h-11 w-full rounded-lg border py-2 pr-3 text-sm text-fg transition-colors duration-150
              placeholder:text-fg-muted
              focus:border-od-green-500 focus:outline-none focus:ring-2 focus:ring-od-green-500/50
              ${leftIcon ? 'pl-10' : 'pl-3'}
              ${error ? 'border-red-600 bg-red-950/20' : 'border-line bg-bg-2'}
              ${className}
            `}
            {...props}
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={describedBy}
          />
        </div>
        {error && <p id={errorId} className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p id={hintId} className="text-xs text-fg-muted">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
