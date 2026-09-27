'use client';
import type { Units } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import { EditorSetRow } from './editor-set-row';
import type { EditErrors, EditExercise, EditSet } from './edit-model';
import '@/lib/i18n/packs/history';

interface Props {
  ex: EditExercise;
  units: Units;
  errors: EditErrors['sets'];
  onSetChange: (setId: string, patch: Partial<EditSet>) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
  onRemoveExercise: () => void;
}

const btn =
  'min-h-11 rounded-lg border border-line px-3 text-xs font-medium text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';

export function EditorExercise({ ex, units, errors, onSetChange, onRemoveSet, onAddSet, onRemoveExercise }: Props) {
  const { t } = useT();
  const name = ex.source.exerciseName;
  return (
    <section data-testid="history-edit-exercise" className="mb-3 rounded-xl border border-line bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-fg">{name}</h2>
        <button type="button" onClick={onRemoveExercise} className={btn}>
          {t('hist_edit_remove_exercise')}
        </button>
      </div>
      {ex.sets.map((s, i) => (
        <EditorSetRow
          key={s.id}
          set={s}
          index={i + 1}
          exerciseName={name}
          units={units}
          error={errors[s.id]}
          onChange={(patch) => onSetChange(s.id, patch)}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}
      <button type="button" data-testid="history-edit-add-set" onClick={onAddSet} className={`${btn} mt-2`}>
        {t('hist_edit_add_set')}
      </button>
    </section>
  );
}
