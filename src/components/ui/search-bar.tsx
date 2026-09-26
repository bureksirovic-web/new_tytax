'use client';
import { CloseIcon, SearchIcon } from './icons';
import { useRef, useEffect } from 'react';
import { useLocale } from '@/components/providers';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, autoFocus, className = '' }: SearchBarProps) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  const text = placeholder ?? t('ui_search_placeholder');

  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={text}
        className="min-h-11 w-full rounded-lg border border-line bg-bg-2 py-2.5 pl-9 pr-11 text-sm text-fg transition-colors
          placeholder:text-fg-muted
          focus:border-od-green-500 focus:outline-none focus:ring-2 focus:ring-od-green-500/50"
        aria-label={text}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
          aria-label={t('clear_search')}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
