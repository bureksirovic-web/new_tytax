'use client';
import type { SetEntry } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import type { SetPatch } from '@/stores/workout-store';
import { NumberField } from './number-field';
import { CheckIcon, CloseIcon } from './icons';

export interface SetRowProps {
  set: SetEntry;
  /** 1-based position shown to the user. */
  index: number;
  onChange: (patch: SetPatch) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}

const RIR_MAX = 5;

export function SetRow({ set, index, onChange, onToggleDone, onRemove }: SetRowProps) {
  const { t } = useLocale();
  const setLabel = `${t('workout_set_label')} ${index}`;
  const rowTone = set.done
    ? 'border-[var(--accent)] bg-[var(--bg-secondary)]'
    : 'border-transparent bg-transparent';

  return (
    <li
      data-testid="set-row"
      data-set-id={set.id}
      data-done={set.done ? 'true' : 'false'}
      className={`flex items-center gap-1.5 rounded-lg border px-1 py-1 ${rowTone}`}
    >
      <span
        className={`w-7 shrink-0 text-center font-mono text-sm ${set.type === 'warmup' ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}
        aria-hidden="true"
      >
        {index}
      </span>
      <NumberField
        testId="set-kg"
        label={`${setLabel}: ${t('workout_weight_kg')}`}
        value={set.kg}
        zeroIsEmpty
        placeholder={set.ghostKg !== undefined ? String(set.ghostKg) : undefined}
        inputMode="decimal"
        step={0.25}
        onValueChange={(v) => onChange({ kg: v ?? 0 })}
      />
      <NumberField
        testId="set-reps"
        label={`${setLabel}: ${t('workout_reps')}`}
        value={set.reps}
        zeroIsEmpty
        placeholder={set.ghostReps !== undefined ? String(set.ghostReps) : undefined}
        inputMode="numeric"
        step={1}
        onValueChange={(v) => onChange({ reps: v === undefined ? 0 : Math.round(v) })}
      />
      <NumberField
        testId="set-rir"
        // i18n: needs `workout_rir` (requested in docs/v2/requests/G1-i18n.md).
        label={`${setLabel}: ${t('workout_reps')} (0–${RIR_MAX})`}
        value={set.rir}
        max={RIR_MAX}
        inputMode="numeric"
        step={1}
        onValueChange={(v) => onChange({ rir: v === undefined ? undefined : Math.round(v) })}
      />
      <button
        type="button"
        data-testid="set-done"
        aria-pressed={set.done}
        aria-label={`${setLabel}: ${t('workout_log_set')}`}
        onClick={onToggleDone}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] ${
          set.done
            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
            : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)]'
        }`}
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        data-testid="remove-set"
        aria-label={`${setLabel}: ${t('delete')}`}
        onClick={onRemove}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </li>
  );
}
