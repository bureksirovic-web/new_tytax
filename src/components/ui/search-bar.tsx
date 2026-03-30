'use client';
import { useRef, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', autoFocus, className = '' }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        ⌕
      </span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-lg border text-sm transition-colors min-h-[44px]
          focus:outline-none focus:ring-2 focus:ring-od-green-500/50 focus:border-od-green-500
          placeholder:text-gunmetal-500"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm hover:opacity-100 opacity-50"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
