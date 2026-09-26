'use client';
import { useRef, type Ref } from 'react';
import type { ExerciseMeasure, Modality, SetEntry, Units } from '@/contracts/domain';
import type { SetPatch } from '@/stores/workout-store';
import { displayToKg, kgToDisplay } from '@/lib/utils';
import { useSetsStrings } from './strings/sets';
import { useTimeStrings } from './strings/time';
import { NumberField } from './number-field';
import { SetRemoveButton } from './set-remove-button';
import { CheckIcon } from './icons';
import { beatsGhostReps, canCompleteSet, canToggleDone, formatNumber, setE1rmKg } from './set-rules';
import { canToggleTimeDone, rowMeasure } from './set-time-rules';
import { SetTimeFields } from './set-time-fields';

export interface SetRowProps {
  set: SetEntry;
  /** 1-based number within its kind (warm-ups are numbered separately). */
  number: number;
  modality: Modality;
  units: Units;
  onChange: (patch: SetPatch) => void;
  /** Complete or undo; the caller runs the side effects (rest timer, focus). */
  onToggleDone: () => void;
  onRemove: () => void;
  /** Receives the kg input, or the duration input of a time set (focus after the previous set is done). */
  kgRef?: Ref<HTMLInputElement>;
  /**
   * The exercise's measure (Wave 2). 'time' shows duration + hold timer + RIR
   * instead of kg/reps/e1RM, and done needs `durationSeconds > 0` (the caller
   * routes the toggle to `toggleTimeSetDone`). Omitted: a set carrying
   * `durationSeconds` is a time set, any other a reps set.
   */
  measure?: ExerciseMeasure;
  /** Time sets: last time's seconds, shown as the duration placeholder. */
  ghostSeconds?: number;
  /** Injectable clock for the hold timer (tests). */
  now?: () => number;
}

const RIR_MAX = 5;
/**
 * The three inputs share the row; kg gets a larger share because it holds the
 * longest value ("102.5"). On phones the e1RM wraps below and the gaps/number
 * column shrink so at 360px every input stays >=44px wide and "102.5" is not
 * clipped (e2e/workout-wave2.spec.ts measures it).
 */
const INPUT_FLEX = 'flex-1 basis-0';
const KG_FLEX = 'flex-[1.4] basis-0';
const RIR_VALUES = [0, 1, 2, 3, 4, 5];

export function SetRow({ set, number, modality, units, onChange, onToggleDone, onRemove, kgRef, measure, ghostSeconds, now }: SetRowProps) {
  const t = useSetsStrings();
  const tt = useTimeStrings();
  const timed = rowMeasure(set, measure) === 'time';
  const repsRef = useRef<HTMLInputElement>(null);
  const warmup = set.type === 'warmup';
  const setLabel = warmup ? t('warmup_label', { n: number }) : t('set_label', { n: number });
  const beat = beatsGhostReps(set);
  const toggleable = timed ? canToggleTimeDone(set) : canToggleDone(set, modality);
  const needsInput = timed ? tt('time_done_needs_duration') : t('set_done_needs_input');
  const e1rm = timed ? 0 : setE1rmKg(set);
  const e1rmText = e1rm > 0 ? formatNumber(kgToDisplay(e1rm, units)) : '';
  const rirListId = `rir-options-${set.id}`;

  const rowTone = set.done
    ? 'border-[var(--accent)] bg-[var(--bg-secondary)]'
    : warmup
      ? 'border-dashed border-[var(--border-color)] bg-transparent opacity-80'
      : 'border-transparent bg-transparent';

  return (
    <li
      data-testid="set-row"
      data-set-id={set.id}
      data-set-type={set.type}
      data-done={set.done ? 'true' : 'false'}
      aria-label={setLabel}
      className={`flex flex-wrap items-center gap-1 rounded-lg border px-1 py-1 sm:flex-nowrap sm:gap-1.5 ${rowTone}`}
    >
      <span
        className={`w-6 shrink-0 text-center sm:w-7 font-mono text-sm ${warmup ? 'font-bold text-[var(--highlight)]' : 'text-[var(--text-secondary)]'}`}
        aria-hidden="true"
      >
        {warmup ? `${t('warmup_badge')}${number}` : number}
      </span>
      {timed ? (
        <SetTimeFields
          set={set}
          setLabel={setLabel}
          ghostSeconds={ghostSeconds}
          durationRef={kgRef}
          now={now}
          onChange={onChange}
          onComplete={onToggleDone}
        />
      ) : (
        <>
          <NumberField
            testId="set-kg"
            inputRef={kgRef}
            label={`${setLabel}: ${t('set_weight', { unit: units })}`}
            value={set.kg > 0 ? kgToDisplay(set.kg, units) : set.kg}
            zeroIsEmpty
            matchTolerance={units === 'lb' ? 0.05 : 0}
            className={KG_FLEX}
            placeholder={set.ghostKg !== undefined ? formatNumber(kgToDisplay(set.ghostKg, units)) : undefined}
            inputMode="decimal"
            step={0.25}
            onEnter={() => repsRef.current?.focus()}
            onValueChange={(v) => onChange({ kg: v === undefined ? 0 : displayToKg(v, units) })}
          />
          <NumberField
            testId="set-reps"
            inputRef={repsRef}
            label={
              beat && set.ghostReps !== undefined
                ? `${setLabel}: ${t('set_reps')}. ${t('set_beat_ghost', { reps: set.ghostReps })}`
                : `${setLabel}: ${t('set_reps')}`
            }
            value={set.reps}
            zeroIsEmpty
            placeholder={set.ghostReps !== undefined ? String(set.ghostReps) : undefined}
            inputMode="numeric"
            step={1}
            dataAttrs={{ 'data-beat': beat ? 'true' : 'false' }}
            className={beat ? `${INPUT_FLEX} border-emerald-500 text-emerald-400 ring-1 ring-emerald-500` : INPUT_FLEX}
            onEnter={() => {
              if (!set.done && canCompleteSet(set, modality)) onToggleDone();
            }}
            onValueChange={(v) => onChange({ reps: v === undefined ? 0 : Math.round(v) })}
          />
          <NumberField
            testId="set-rir"
            list={rirListId}
            label={`${setLabel}: ${t('set_rir')}`}
            value={set.rir}
            max={RIR_MAX}
            className={INPUT_FLEX}
            inputMode="numeric"
            step={1}
            onValueChange={(v) => onChange({ rir: v === undefined ? undefined : Math.round(v) })}
          />
          <datalist id={rirListId}>
            {RIR_VALUES.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <output
            data-testid="set-e1rm"
            aria-label={e1rmText ? `${t('set_e1rm_label')}: ${e1rmText}` : t('set_e1rm_label')}
            title={e1rmText ? t('set_e1rm', { value: e1rmText }) : undefined}
            className="order-last basis-full pr-1 text-right empty:hidden sm:empty:block font-mono text-[11px] leading-tight text-[var(--text-muted)] sm:order-none sm:w-12 sm:shrink-0 sm:basis-auto sm:pr-0 sm:text-center"
          >
            {e1rmText}
          </output>
        </>
      )}
      <button
        type="button"
        data-testid="set-done"
        aria-pressed={set.done}
        disabled={!toggleable}
        title={toggleable ? undefined : needsInput}
        aria-label={`${setLabel}: ${set.done ? t('set_mark_undone') : t('set_mark_done')}`}
        onClick={onToggleDone}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] disabled:cursor-not-allowed disabled:opacity-40 ${
          set.done
            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
            : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)]'
        }`}
      >
        <CheckIcon />
      </button>
      <SetRemoveButton set={set} label={`${setLabel}: ${t('set_remove')}`} onRemove={onRemove} />
    </li>
  );
}
