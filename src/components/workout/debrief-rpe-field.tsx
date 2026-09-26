'use client';
import { useId } from 'react';
import { useFinishStrings } from '@/components/workout/strings/finish';

export const RPE_MIN = 1;
export const RPE_MAX = 10;
const QUICK_RPE = [6, 7, 8, 9, 10] as const;

/** Free text → RPE clamped to 1–10 and rounded; blank or not a number → undefined. */
export function parseRpe(text: string): number | undefined {
  const trimmed = text.trim();
  const n = Number(trimmed.replace(',', '.'));
  if (trimmed === '' || !Number.isFinite(n)) return undefined;
  return Math.min(RPE_MAX, Math.max(RPE_MIN, Math.round(n)));
}

export interface DebriefRpeFieldProps {
  value: string;
  onChange: (text: string) => void;
}

/** Session RPE: the numeric input plus quick buttons 6–10 that fill it (none selected by default). */
export function DebriefRpeField({ value, onChange }: DebriefRpeFieldProps) {
  const t = useFinishStrings();
  const id = useId();
  const selected = parseRpe(value);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs uppercase tracking-widest text-[var(--text-muted)]">
        {t('rpe_label')}
      </label>
      <div role="group" aria-label={t('rpe_quick')} className="mb-2 grid grid-cols-5 gap-2">
        {QUICK_RPE.map((n) => {
          const on = selected === n;
          return (
            <button
              key={n}
              type="button"
              data-testid={`debrief-rpe-${n}`}
              aria-pressed={on}
              aria-label={t('rpe_quick_n', { n })}
              onClick={() => onChange(on ? '' : String(n))}
              className={`min-h-11 min-w-11 rounded-lg border font-mono text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] ${
                on
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={RPE_MIN}
        max={RPE_MAX}
        step={1}
        value={value}
        data-testid="debrief-rpe"
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 font-mono text-base text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      />
    </div>
  );
}
