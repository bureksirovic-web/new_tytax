'use client';
import { useState, type Ref } from 'react';

export interface NumberFieldProps {
  /** Stored value; `undefined` (or 0 when `zeroIsEmpty`) renders as an empty field. */
  value: number | undefined;
  /** Called with the parsed value, or `undefined` when the field is cleared. */
  onValueChange: (value: number | undefined) => void;
  label: string;
  testId: string;
  placeholder?: string;
  inputMode: 'decimal' | 'numeric';
  step: number;
  min?: number;
  max?: number;
  zeroIsEmpty?: boolean;
  className?: string;
  /** Ref to the underlying input (focus management). */
  inputRef?: Ref<HTMLInputElement>;
  /** Enter key pressed (default prevented). */
  onEnter?: () => void;
  /** id of a <datalist> with suggested values. */
  list?: string;
  /** Extra data attributes on the input, e.g. `{ 'data-beat': 'true' }`. */
  dataAttrs?: Record<`data-${string}`, string>;
  /**
   * Typed text within this distance of the stored value is left alone on a
   * resync (a rounded display, e.g. lb shown to 0.1, must not rewrite "102.25").
   */
  matchTolerance?: number;
}

function format(value: number | undefined, zeroIsEmpty: boolean): string {
  if (value === undefined || (zeroIsEmpty && value === 0)) return '';
  return String(value);
}

function parse(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Controlled number input that keeps the typed text locally (so "62." or an
 * empty field survive while typing) and pushes every valid value to the store.
 */
export function NumberField({
  value,
  onValueChange,
  label,
  testId,
  placeholder,
  inputMode,
  step,
  min = 0,
  max,
  zeroIsEmpty = false,
  className = '',
  inputRef,
  onEnter,
  list,
  dataAttrs,
  matchTolerance = 0,
}: NumberFieldProps) {
  const [text, setText] = useState(() => format(value, zeroIsEmpty));
  const [shown, setShown] = useState(value);

  // The store changed underneath us (clamp, reload, another control): resync.
  if (shown !== value) {
    setShown(value);
    const typed = parse(text);
    const typedMeansValue =
      typed === value ||
      (typeof typed === 'number' && value !== undefined && Math.abs(typed - value) < matchTolerance) ||
      (zeroIsEmpty && typed === undefined && value === 0);
    if (!typedMeansValue) setText(format(value, zeroIsEmpty));
  }

  function handleChange(next: string) {
    setText(next);
    const n = parse(next);
    if (n === null) return;
    if (n === undefined) {
      onValueChange(undefined);
      return;
    }
    const clamped = Math.max(min, max === undefined ? n : Math.min(max, n));
    // Show what is stored: the store may already hold `clamped`, so no resync would follow.
    if (clamped !== n) setText(format(clamped, zeroIsEmpty));
    onValueChange(clamped);
  }

  return (
    <input
      {...dataAttrs}
      ref={inputRef}
      list={list}
      type="number"
      inputMode={inputMode}
      step={step}
      min={min}
      max={max}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      data-testid={testId}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !onEnter) return;
        e.preventDefault();
        onEnter();
      }}
      className={`min-h-11 w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 text-center font-mono text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] ${className}`}
    />
  );
}
