'use client';
import { useState, type Ref } from 'react';
import { cleanSeconds, formatDuration, parseDuration } from '@/stores/measure';

export interface DurationFieldProps {
  /** Stored whole seconds; undefined or 0 renders as an empty field. */
  value: number | undefined;
  /** Parsed seconds, or undefined when the field is cleared. Unparsable text is not pushed. */
  onValueChange: (seconds: number | undefined) => void;
  label: string;
  placeholder?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Enter key pressed (default prevented). */
  onEnter?: () => void;
}

/** Stored seconds as shown when not typing: "0:45", "1:30"; empty for none. */
export function durationText(value: number | undefined): string {
  const s = cleanSeconds(value);
  return s > 0 ? formatDuration(s) : '';
}

/** Typed text → seconds (undefined = cleared, null = unparsable). "45" and "1:30" both work. */
export function parseDurationText(text: string): number | undefined | null {
  if (text.trim() === '') return undefined;
  return parseDuration(text) ?? null;
}

/**
 * Duration input for a time set (testid set-duration): a text input with
 * inputMode numeric that accepts seconds ("45") or m:ss ("1:30"). The typed
 * text is kept while typing; leaving the field shows the stored m:ss. A store
 * change from elsewhere (the hold timer) replaces the text.
 */
export function DurationField({ value, onValueChange, label, placeholder, className = '', inputRef, onEnter }: DurationFieldProps) {
  const [text, setText] = useState(() => durationText(value));
  const [shown, setShown] = useState(value);

  if (shown !== value) {
    setShown(value);
    const typed = parseDurationText(text);
    const same = typed === cleanSeconds(value) || (typed === undefined && cleanSeconds(value) === 0);
    if (!same) setText(durationText(value));
  }

  function handleChange(next: string) {
    setText(next);
    const seconds = parseDurationText(next);
    if (seconds !== null) onValueChange(seconds);
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      data-testid="set-duration"
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setText(durationText(value))}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !onEnter) return;
        e.preventDefault();
        onEnter();
      }}
      className={`min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1 sm:px-2 text-center font-mono text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] ${className}`}
    />
  );
}
