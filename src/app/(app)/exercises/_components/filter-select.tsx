'use client';
import { useId } from 'react';

interface FilterSelectProps {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
  testId?: string;
}

/** Labelled native select; the empty option means "no filter". */
export function FilterSelect({ label, allLabel, value, options, onChange, testId }: FilterSelectProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-display text-xs font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        data-testid={testId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="min-h-11 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg focus:border-od-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-od-green-500/50"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
