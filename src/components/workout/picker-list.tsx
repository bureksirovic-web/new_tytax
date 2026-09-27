'use client';
import type { Exercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { muscleKey, usePickerStrings } from './strings/picker';
import '@/lib/i18n/packs/g3Picker';

export interface PickerListProps {
  exercises: readonly Exercise[];
  onPick: (exercise: Exercise) => void;
  /** data-testid of each option button. */
  optionTestId: 'exercise-option' | 'swap-option';
  /** Total matches; a "show more" button appears when it exceeds `exercises.length`. */
  total?: number;
  onShowMore?: () => void;
}

const MODALITY_KEYS = {
  tytax: 'modality_tytax',
  bodyweight: 'modality_bodyweight',
  kettlebell: 'modality_kettlebell',
  custom: 'modality_custom',
} as const;

/** Exercise option buttons (name + muscle group + equipment), optional "show more". */
export function PickerList({ exercises, onPick, optionTestId, total, onShowMore }: PickerListProps) {
  const { t } = useLocale();
  const s = usePickerStrings();
  const more = total !== undefined && onShowMore !== undefined && total > exercises.length;
  const showing = s('picker_showing', { shown: exercises.length, total: total ?? exercises.length });

  return (
    <>
      <ul className="space-y-1">
        {exercises.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              data-testid={optionTestId}
              data-exercise-id={ex.id}
              data-muscle-group={ex.muscleGroup}
              onClick={() => onPick(ex)}
              className="flex min-h-11 w-full flex-col items-start justify-center rounded-lg px-3 py-2 text-left hover:bg-[var(--bg-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">{ex.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {s(muscleKey(ex.muscleGroup))} · {t(MODALITY_KEYS[ex.modality])}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <div className="flex flex-col items-center gap-2 py-3">
          <p role="status" className="text-xs text-[var(--text-muted)]">
            {showing}
          </p>
          <button
            type="button"
            data-testid="exercise-show-more"
            onClick={onShowMore}
            className="min-h-11 min-w-11 rounded-lg border border-[var(--border-color)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
          >
            {t('load_more')}
          </button>
        </div>
      )}
    </>
  );
}
