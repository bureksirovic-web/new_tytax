'use client';
import type { MuscleGroup } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { PICKER_MODALITIES, type PickerFilter, type PickerModality } from './picker-filter';
import { PICKER_INPUT_CLASS } from './picker-dialog';
import { MUSCLE_GROUP_VALUES, muscleKey, usePickerStrings } from './strings/picker';
import '@/lib/i18n/packs/g3Picker';

export interface PickerControlsProps {
  filter: PickerFilter;
  onChange: (patch: Partial<PickerFilter>) => void;
  /** Enter in the search box. */
  onSubmit: () => void;
}

const MODALITY_LABEL = {
  all: 'all_modalities',
  tytax: 'modality_tytax',
  bodyweight: 'modality_bodyweight',
  kettlebell: 'modality_kettlebell',
} as const;

const labelClass = 'flex flex-col gap-1 text-xs uppercase text-[var(--text-muted)]';

/** Search box (focused on open, Enter submits) plus modality and muscle-group filters. */
export function PickerControls({ filter, onChange, onSubmit }: PickerControlsProps) {
  const { t } = useLocale();
  const s = usePickerStrings();
  const modalityLabel = s('picker_filter_modality');
  const muscleLabel = s('picker_filter_muscle');

  return (
    <div className="mb-3 flex flex-col gap-2">
      <input
        type="search"
        data-testid="exercise-search"
        aria-label={t('search_exercises')}
        placeholder={t('search_exercises')}
        value={filter.text}
        autoFocus
        onChange={(e) => onChange({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={PICKER_INPUT_CLASS}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className={labelClass}>
          {modalityLabel}
          <select
            data-testid="exercise-filter-modality"
            value={filter.modality}
            onChange={(e) => onChange({ modality: e.target.value as PickerModality })}
            className={PICKER_INPUT_CLASS}
          >
            {PICKER_MODALITIES.map((m) => (
              <option key={m} value={m}>
                {t(MODALITY_LABEL[m])}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {muscleLabel}
          <select
            data-testid="exercise-filter-muscle"
            value={filter.muscle}
            onChange={(e) => onChange({ muscle: e.target.value as MuscleGroup | '' })}
            className={PICKER_INPUT_CLASS}
          >
            <option value="">{t('all_muscles')}</option>
            {MUSCLE_GROUP_VALUES.map((g) => (
              <option key={g} value={g}>
                {s(muscleKey(g))}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
