'use client';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{children}</h2>
  );
}

export function Section({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4"
    >
      {children}
    </section>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/** A single-choice radio group rendered as chips (44px touch targets). */
export function ChoiceChips<T extends string>({
  name,
  choices,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  choices: readonly Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {choices.map((c) => {
        const selected = c.value === value;
        return (
          <label
            key={c.value}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm text-[var(--text-primary)] transition-colors ${
              selected
                ? 'border-od-green-500 bg-od-green-500/10'
                : 'border-[var(--border-color)] bg-[var(--bg-card)]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              disabled={disabled}
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
