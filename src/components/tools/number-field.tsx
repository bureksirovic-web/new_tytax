'use client';
import { useId } from 'react';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  integer?: boolean;
}

/** Labelled decimal input, 44px tall, accepts "," or "." as separator. */
export function NumberField({ label, value, onChange, testId, integer = false }: NumberFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase text-[var(--text-muted)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        data-testid={testId}
        className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 font-mono text-lg text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
    </div>
  );
}

/** "112.5", "1.25", "100" — no trailing zeros. */
export function formatKg(kg: number): string {
  return String(Number(kg.toFixed(3)));
}
