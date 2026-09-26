import type { Modality, SetEntry, WorkoutLog } from '@/contracts/domain';
import type { PrefillBasis, PrefillFromHistoryFn } from '@/contracts/training';
import { clean, isDoneWorkingSet, liveLogs, newId } from './common';

/** Progression increments by last session's lowest recorded RIR. */
export const PREFILL_INCREMENT_KG: Readonly<Record<PrefillBasis, number>> = Object.freeze({
  none: 0,
  rir3plus: 2.5,
  rir2: 1.25,
  hold: 0,
});

function startedMs(l: WorkoutLog): number {
  const t = Date.parse(l.startedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Done sets of type `working` of `exerciseId` in one log, across every
 * occurrence, in order. Drop and failure sets are excluded here (they still
 * count for PRs, volume and load): a finishing drop set must not block
 * progression or come back as an extra working set.
 */
function doneSetsFor(log: WorkoutLog, exerciseId: string): { sets: SetEntry[]; modality?: Modality } {
  const out: SetEntry[] = [];
  let modality: Modality | undefined;
  for (const ex of log.exercises) {
    if (ex.exerciseId !== exerciseId) continue;
    modality ??= ex.modality;
    for (const s of ex.sets) if (isDoneWorkingSet(s) && s.type === 'working') out.push(s);
  }
  return { sets: out, modality };
}

/**
 * The next weight: `base + inc`, except
 * - bodyweight sets (base 0 kg) progress on ghost reps only (+0 kg);
 * - kettlebells jump between real bells: with `availableKg` the result snaps
 *   up to the lightest bell ≥ base + inc (or stays at base when none is);
 *   without it the weight holds.
 */
export function nextKg(base: number, inc: number, modality: Modality | undefined, availableKg?: readonly number[]): number {
  if (!(inc > 0) || !(base > 0)) return clean(base);
  const target = clean(base + inc);
  if (availableKg && availableKg.length) {
    const up = [...availableKg].filter((k) => k >= target).sort((a, b) => a - b)[0];
    return up ?? clean(base);
  }
  if (modality === 'kettlebell') return clean(base);
  return target;
}

function basisFor(sets: readonly SetEntry[]): PrefillBasis {
  let min: number | undefined;
  for (const s of sets) {
    if (typeof s.rir !== 'number' || Number.isNaN(s.rir)) continue;
    min = min === undefined ? s.rir : Math.min(min, s.rir);
  }
  if (min === undefined) return 'hold';
  if (min >= 3) return 'rir3plus';
  if (min === 2) return 'rir2';
  return 'hold';
}

function blankSet(kg: number): SetEntry {
  return { id: newId(), type: 'working', kg, reps: 0, done: false };
}

/**
 * Pre-filled working sets for the next session of `exerciseId`.
 *
 * Source: the newest (by `startedAt`) non-deleted log that has at least one
 * done working set of the exercise — a log where the exercise was added but
 * never done does not reset the progression. Its done working sets across
 * every occurrence of the exercise, in order, are "last time".
 * Only sets of type `working` are "last time" (drop/failure excluded).
 * Increment: lowest recorded RIR ≥3 → +2.5 kg, exactly 2 → +1.25 kg,
 * otherwise or unrecorded → +0; see `nextKg` for bodyweight (0 kg) and
 * kettlebells. Set i gets `kg = nextKg(last[i].kg)` (or the last set's kg
 * when this session has more sets) and `ghostKg/ghostReps` from `last[i]`.
 */
export const prefillFromHistory: PrefillFromHistoryFn = (exerciseId, history, opts) => {
  const requested = opts?.targetSets !== undefined ? Math.max(1, Math.floor(opts.targetSets)) : undefined;
  const candidates = liveLogs(history)
    .map((log) => ({ log, ...doneSetsFor(log, exerciseId) }))
    .filter((c) => c.sets.length > 0)
    .sort((a, b) => startedMs(b.log) - startedMs(a.log));
  const source = candidates[0];
  if (!source) {
    const n = requested ?? 1;
    return { sets: Array.from({ length: n }, () => blankSet(0)), suggestedKg: 0, basis: 'none' };
  }
  const last = source.sets;
  const basis = basisFor(last);
  const inc = PREFILL_INCREMENT_KG[basis];
  const n = requested ?? last.length;
  const tail = last[last.length - 1];
  const sets: SetEntry[] = Array.from({ length: n }, (_, i) => {
    const prev: SetEntry | undefined = last[i];
    const set = blankSet(nextKg((prev ?? tail).kg, inc, source.modality, opts?.availableKg));
    if (prev) {
      set.ghostKg = prev.kg;
      set.ghostReps = prev.reps;
    }
    return set;
  });
  return { sets, suggestedKg: sets[0].kg, basis, sourceLogId: source.log.id };
};
