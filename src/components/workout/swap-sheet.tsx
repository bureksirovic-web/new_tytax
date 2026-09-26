'use client';
import { useMemo, useState } from 'react';
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { useCatalog } from '@/hooks/use-exercises';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { swapAvailability } from './picker-filter';
import { isNameSearch, swapCandidates } from './picker-swap';
import { PICKER_INPUT_CLASS, PickerDialog, PickerStatus } from './picker-dialog';
import { PickerList } from './picker-list';
import { usePickerStrings } from './strings/picker';

export interface SwapSheetProps {
  exercise: SessionExercise;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/**
 * Swap an exercise of the running session. Lists catalog exercises sharing
 * its muscle group and/or movement pattern (both first), filtered by the
 * active profile's equipment inventory; more than 2 typed characters switch
 * to a name search. At most 30 options.
 */
export function SwapSheet({ exercise, onPick, onClose }: SwapSheetProps) {
  const { t } = useLocale();
  const s = usePickerStrings();
  const [query, setQuery] = useState('');
  const { catalog, loading: catalogLoading, error } = useCatalog();
  const { profileId, loading: profileLoading } = useActiveProfile();
  const inventory = useRepoQuery(
    async (repo) => (profileId ? repo.equipment.get(profileId) : null),
    [profileId],
  );
  const loading = catalogLoading || profileLoading || inventory.loading;

  const target = catalog?.getById(exercise.exerciseId);
  const options = useMemo(() => {
    if (!catalog || loading) return [];
    return swapCandidates({
      exercise,
      catalogExercises: catalog.exercises,
      target,
      query,
      isAvailable: swapAvailability(inventory.data),
    });
  }, [catalog, loading, exercise, target, query, inventory.data]);

  const nameSearch = isNameSearch(query);
  const title = s('swap_title', { name: exercise.exerciseName });
  const heading = nameSearch ? s('swap_results') : s('swap_similar');
  const emptyText = !target && !nameSearch ? s('swap_type_more') : s('swap_none');

  function submit() {
    if (options.length > 0) onPick(options[0]);
  }

  return (
    <PickerDialog
      title={title}
      testId="swap-sheet"
      closeTestId="swap-sheet-close"
      onClose={onClose}
      busy={loading}
      header={
        <input
          type="search"
          data-testid="swap-search"
          aria-label={s('swap_search')}
          placeholder={s('swap_search')}
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          className={`mb-3 ${PICKER_INPUT_CLASS}`}
        />
      }
    >
      {error !== undefined && <PickerStatus>{t('error')}</PickerStatus>}
      {loading && error === undefined && <PickerStatus>{t('loading')}</PickerStatus>}
      {!loading && (
        <h3 className="mb-1 px-3 text-xs uppercase text-[var(--text-muted)]">
          {heading}
        </h3>
      )}
      {!loading && options.length === 0 && (
        <PickerStatus>{emptyText}</PickerStatus>
      )}
      <PickerList exercises={options} onPick={onPick} optionTestId="swap-option" />
    </PickerDialog>
  );
}
