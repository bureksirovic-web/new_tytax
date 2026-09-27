'use client';
import { useId } from 'react';

/** A settings card: `<section aria-labelledby>` with an h2. */
export function SettingsCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-testid={testId} className="space-y-3 rounded-xl border border-line bg-bg-2 p-4">
      <h2 id={id} className="font-display text-sm font-semibold uppercase tracking-widest text-fg-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A label/value subheading inside a card. */
export function FieldLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="text-xs font-medium uppercase tracking-wider text-fg-muted">
      {children}
    </p>
  );
}

export function Hint({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="text-xs text-fg-muted">
      {children}
    </p>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  testId?: string;
}

/** A single-choice radio group rendered as chips (44px touch targets). */
export function ChoiceChips<T extends string>({
  name,
  label,
  choices,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  label: string;
  choices: readonly Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {choices.map((c) => {
        const selected = c.value === value;
        return (
          <label
            key={c.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm text-fg transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-tactical-amber-400 ${
              selected ? 'border-od-green-500 bg-od-green-500/15' : 'border-line bg-card hover:bg-card-hover'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              disabled={disabled}
              data-testid={c.testId}
              onChange={() => onChange(c.value)}
              className="sr-only"
            />
            {c.label}
          </label>
        );
      })}
    </div>
  );
}

/** An on/off switch (`role="switch"`), with a visible label and optional hint. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  testId,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p id={`${id}-l`} className="text-sm text-fg">
          {label}
        </p>
        {hint && <Hint id={`${id}-h`}>{hint}</Hint>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={hint ? `${id}-h` : undefined}
        data-testid={testId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex min-h-11 min-w-16 shrink-0 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400 disabled:opacity-50 ${
          checked ? 'bg-od-green-600' : 'bg-gunmetal-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`block h-7 w-7 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-7' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

const selectClass =
  'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** A labelled native select. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  testId?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        data-testid={testId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
