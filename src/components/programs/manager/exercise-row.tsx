'use client';
import { useState } from 'react';
import type { ProgramExercise } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useT } from '@/lib/i18n/use-t';
import { REST_MAX, REST_MIN, REST_STEP, SETS_MAX, SETS_MIN, clamp, isValidReps } from '../lib/session-edit';

/** Icon glyph (not copy); the button's name comes from aria-label. */
const REMOVE_GLYPH = '✕';

const iconBtn =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30';

interface ExerciseRowProps {
  slot: ProgramExercise;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onPatch: (index: number, patch: Partial<ProgramExercise>) => void;
}

/** One exercise slot: scheme, ↑/↓, remove (by index), inline edit of sets/reps/rest. */
export function ExerciseRow({ slot, index, count, onMove, onRemove, onPatch }: ExerciseRowProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(slot.sets);
  const [reps, setReps] = useState(slot.reps);
  const [rest, setRest] = useState(slot.restSeconds ?? 0);
  const repsOk = isValidReps(reps);
  const repsId = `reps-${slot.exerciseId}-${index}`;

  function open() {
    setSets(slot.sets);
    setReps(slot.reps);
    setRest(slot.restSeconds ?? 0);
    setEditing(true);
  }

  function done() {
    if (!repsOk) return;
    onPatch(index, { sets: clamp(sets, SETS_MIN, SETS_MAX), reps: reps.trim(), restSeconds: clamp(rest, REST_MIN, REST_MAX) });
    setEditing(false);
  }

  return (
    <li className="border-t border-line px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : open())}
          aria-expanded={editing}
          aria-label={t('prog_edit_named', { name: slot.exerciseName })}
          className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-left hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block truncate text-sm text-fg">{slot.exerciseName}</span>
          <span className="block font-mono text-xs text-fg-muted">
            {t('prog_scheme', { sets: slot.sets, reps: slot.reps })}
            {slot.restSeconds ? ` · ${t('prog_rest_short', { s: slot.restSeconds })}` : ''}
          </span>
        </button>
        <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t('prog_move_up_named', { name: slot.exerciseName })}>
          <span aria-hidden="true">↑</span>
        </button>
        <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={t('prog_move_down_named', { name: slot.exerciseName })}>
          <span aria-hidden="true">↓</span>
        </button>
        <button type="button" className={iconBtn} onClick={() => onRemove(index)} aria-label={t('prog_slot_remove', { name: slot.exerciseName })}>
          <span aria-hidden="true">{REMOVE_GLYPH}</span>
        </button>
      </div>
      {editing ? (
        <div className="mt-2 grid gap-3 rounded-lg bg-bg-2 p-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-fg-muted">{t('prog_sets')}</p>
            <NumberStepper value={sets} onChange={setSets} step={1} min={SETS_MIN} max={SETS_MAX} format={(v) => String(v)} ariaLabel={t('prog_sets')} />
          </div>
          <div>
            <label htmlFor={repsId} className="mb-1 block text-xs text-fg-muted">
              {t('prog_reps')}
            </label>
            <input
              id={repsId}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              aria-invalid={!repsOk}
              aria-describedby={repsOk ? undefined : `${repsId}-err`}
              className={`min-h-11 w-full rounded-lg border bg-card px-3 font-mono text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${repsOk ? 'border-line' : 'border-red-500'}`}
            />
            {repsOk ? null : (
              <p id={`${repsId}-err`} role="alert" className="mt-1 text-xs text-red-400">
                {t('prog_reps_invalid')}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-fg-muted">{t('prog_rest_seconds')}</p>
            <NumberStepper value={rest} onChange={setRest} step={REST_STEP} min={REST_MIN} max={REST_MAX} format={(v) => String(v)} ariaLabel={t('prog_rest_seconds')} />
          </div>
          <div className="sm:col-span-3">
            <Button size="sm" variant="primary" disabled={!repsOk} onClick={done}>
              {t('prog_done')}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
