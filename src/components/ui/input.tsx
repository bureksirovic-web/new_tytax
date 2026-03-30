'use client';
import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-lg border text-sm transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-od-green-500/50 focus:border-od-green-500
              placeholder:text-gunmetal-500
              min-h-[44px]
              ${leftIcon ? 'pl-10' : 'pl-3'} pr-3 py-2
              ${error ? 'border-red-600 bg-red-950/20' : ''}
              ${className}
            `}
            style={{
              backgroundColor: error ? undefined : 'var(--bg-secondary)',
              borderColor: error ? undefined : 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
