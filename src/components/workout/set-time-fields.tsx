'use client';
import { useEffect, type Ref } from 'react';
import type { SetEntry } from '@/contracts/domain';
import type { SetPatch } from '@/stores/workout-store';
import { formatDuration } from '@/stores/measure';
import { useTimeStrings } from './strings/time';
import { NumberField } from './number-field';
import { DurationField } from './set-time-duration';
import { HoldTimerButton } from './hold-timer-button';
import { canCompleteTimeSet, ghostSecondsOf } from './set-time-rules';
import { useHoldTimer } from './hold-timer';
import '@/lib/i18n/packs/g3Session';

export interface SetTimeFieldsProps {
  set: SetEntry;
  /** "Set 2" / "Warm-up 1": prefixes every accessible name. */
  setLabel: string;
  /** Last time's seconds for this set: shown as the duration placeholder. */
  ghostSeconds?: number;
  onChange: (patch: SetPatch) => void;
  /** Enter in the duration field on a timed, not-done set. */
  onComplete: () => void;
  /** Receives the duration input (focus after the previous set is done). */
  durationRef?: Ref<HTMLInputElement>;
  /** Injectable clock for the hold timer (tests). */
  now?: () => number;
}

const RIR_MAX = 5;
const INPUT_FLEX = 'flex-1 basis-0';
/** RIR is one digit (0-5): 44 px on phones, so the duration gets the rest of the row. */
const RIR_FLEX = 'flex-none max-w-11 sm:max-w-none sm:flex-1 sm:basis-0';

/**
 * The inputs of a time-measured set row: duration (seconds or m:ss), the
 * start/stop hold timer (stop writes `durationSeconds`) and an optional RIR.
 * No kg, reps or e1RM. Clearing the duration stores 0 s (still a time set);
 * a hold stopped under 1 s writes nothing. Last session's hold is only the
 * placeholder; Enter on an empty duration adopts it through `onComplete`
 * (the ghost-reps rule). Typing a duration, or the set becoming done, cancels
 * a running hold (refuter-2 F2), so a stop never overwrites a typed value.
 */
export function SetTimeFields({ set, setLabel, ghostSeconds, onChange, onComplete, durationRef, now }: SetTimeFieldsProps) {
  const t = useTimeStrings();
  const hold = useHoldTimer(now, undefined, set.id, !set.done);
  const { running, cancel } = hold;
  useEffect(() => {
    if (set.done && running) cancel();
  }, [set.done, running, cancel]);
  const ghost = ghostSecondsOf(ghostSeconds);
  const ghostText = ghost !== undefined ? formatDuration(ghost) : undefined;
  const durationLabel = ghostText
    ? `${setLabel}: ${t('time_duration')}. ${t('time_ghost', { time: ghostText })}`
    : `${setLabel}: ${t('time_duration')}`;

  return (
    <>
      <DurationField
        inputRef={durationRef}
        label={durationLabel}
        value={set.durationSeconds}
        placeholder={ghostText ?? t('time_placeholder')}
        className={INPUT_FLEX}
        onEnter={() => {
          if (!set.done && canCompleteTimeSet(set, ghostSeconds)) onComplete();
        }}
        onValueChange={(v) => {
          if (running) cancel();
          onChange({ durationSeconds: v ?? 0 });
        }}
      />
      <HoldTimerButton
        hold={hold}
        startLabel={`${setLabel}: ${t('time_hold_start')}`}
        stopLabel={(time) => `${setLabel}: ${t('time_hold_stop', { time })}`}
        onStop={(seconds) => {
          // A sub-second tap is a mis-tap: it never wipes a duration already entered.
          if (seconds > 0) onChange({ durationSeconds: seconds });
        }}
      />
      <NumberField
        testId="set-rir"
        label={`${setLabel}: ${t('time_rir')}`}
        value={set.rir}
        max={RIR_MAX}
        className={RIR_FLEX}
        inputMode="numeric"
        step={1}
        onValueChange={(v) => onChange({ rir: v === undefined ? undefined : Math.round(v) })}
      />
    </>
  );
}
