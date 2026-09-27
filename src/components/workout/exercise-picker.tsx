'use client';
import { useMemo, useState } from 'react';
import type { Exercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { useCatalog } from '@/hooks/use-exercises';
import {
  DEFAULT_PICKER_FILTER,
  PICKER_PAGE_SIZE,
  filterPickerExercises,
  type PickerFilter,
} from './picker-filter';
import { PickerControls } from './picker-controls';
import { PickerDialog, PickerStatus } from './picker-dialog';
import { PickerList } from './picker-list';

export interface ExercisePickerProps {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/**
 * Modal exercise search over the lazy catalog (all chunks, loaded once and
 * memoised). Search and filters run in memory; the list shows
 * `PICKER_PAGE_SIZE` rows at a time. Keyboard: search is focused on open,
 * Enter picks the first match, Escape closes.
 */
export function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const { t } = useLocale();
  const { catalog, loading, error } = useCatalog();
  const [filter, setFilter] = useState<PickerFilter>(DEFAULT_PICKER_FILTER);
  const [visible, setVisible] = useState(PICKER_PAGE_SIZE);

  const matches = useMemo(
    () => (catalog ? filterPickerExercises(catalog.exercises, filter) : []),
    [catalog, filter],
  );
  const shown = matches.slice(0, visible);

  function change(patch: Partial<PickerFilter>) {
    setFilter((prev) => ({ ...prev, ...patch }));
    setVisible(PICKER_PAGE_SIZE);
  }

  function pickFirst() {
    if (matches.length > 0) onPick(matches[0]);
  }

  return (
    <PickerDialog
      title={t('add_exercise')}
      testId="exercise-picker"
      closeTestId="exercise-picker-close"
      onClose={onClose}
      busy={loading}
      header={<PickerControls filter={filter} onChange={change} onSubmit={pickFirst} />}
    >
      {error !== undefined && <PickerStatus>{t('error')}</PickerStatus>}
      {loading && <PickerStatus>{t('loading')}</PickerStatus>}
      {catalog && matches.length === 0 && <PickerStatus>{t('no_exercises_found')}</PickerStatus>}
      <PickerList
        exercises={shown}
        onPick={onPick}
        optionTestId="exercise-option"
        total={matches.length}
        onShowMore={() => setVisible((v) => v + PICKER_PAGE_SIZE)}
      />
    </PickerDialog>
  );
}
