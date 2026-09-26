/**
 * Pure rules behind the set rows and the session exercise card (G3).
 * No React, no store: every function takes plain data and is unit tested in
 * __tests__/set-rules.test.ts.
 */
import type { Modality, ProfileSettings, SessionExercise, SetEntry } from '@/contracts/domain';
import { training } from '@/lib/training';
import { beatsGhost } from './runtime/ghost';
import { createRestAlerts, type RestAlerts } from './runtime/rest-alerts';

/** Rest length used when neither the exercise nor the profile names one. */
export const FALLBACK_REST_S = 90;
/** Short haptic tick when a set is marked done. */
export const DONE_VIBRATION_MS = 50;
/** Fallback warm-up when the profile's strategy is 'none' (or yields nothing). */
export const FALLBACK_WARMUP_RATIO = 0.5;
export const FALLBACK_WARMUP_REPS = 10;
const ROUND_KG = 2.5;

/** Bodyweight work may be logged at 0 kg. */
export function allowsZeroKg(modality: Modality): boolean {
  return modality === 'bodyweight';
}

/** A set can be marked done once it has reps and (unless bodyweight) a weight. */
export function canCompleteSet(set: SetEntry, modality: Modality): boolean {
  return set.reps > 0 && (set.kg > 0 || allowsZeroKg(modality));
}

/** The done button is usable to complete a ready set, and always to undo. */
export function canToggleDone(set: SetEntry, modality: Modality): boolean {
  return set.done || canCompleteSet(set, modality);
}

/** "Beat it": typed reps above last session's (positive) reps for this set. */
export function beatsGhostReps(set: SetEntry): boolean {
  return beatsGhost(set.reps, set.ghostReps);
}

/** True when deleting the set would throw away something the user entered. */
export function setHasData(set: SetEntry): boolean {
  return set.done || set.kg > 0 || set.reps > 0 || set.rir !== undefined;
}

/** Live e1RM in kg (training.e1rm: Brzycki ≤36 reps, Epley ≥37); 0 for warm-ups and empty sets. */
export function setE1rmKg(set: SetEntry): number {
  if (set.type === 'warmup') return 0;
  return training.e1rm(set.kg, set.reps);
}

/** Rest after a set: exercise → profile → 90 s. */
export function restSecondsFor(exercise: Pick<SessionExercise, 'restSeconds'>, settings?: Partial<ProfileSettings>): number {
  const pick = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
  return pick(exercise.restSeconds) ?? pick(settings?.restSeconds) ?? FALLBACK_REST_S;
}

/** Heaviest kg among non-warm-up sets (typed or ghost); 0 when none. */
export function heaviestWorkingKg(sets: readonly SetEntry[]): number {
  let max = 0;
  for (const s of sets) {
    if (s.type === 'warmup') continue;
    max = Math.max(max, s.kg > 0 ? s.kg : (s.ghostKg ?? 0));
  }
  return max;
}

export function hasWarmups(sets: readonly SetEntry[]): boolean {
  return sets.some((s) => s.type === 'warmup');
}

function roundTo(kg: number, step: number): number {
  return Math.round(kg / step) * step;
}

/**
 * Warm-ups for `workingKg` with the profile's strategy (training.generateWarmups);
 * strategy 'none', or a strategy that yields nothing, falls back to one set
 * at 50% × 10. `newId` is injectable for tests.
 */
export function buildWarmups(
  workingKg: number,
  settings: Pick<ProfileSettings, 'warmupStrategy' | 'barWeightKg'>,
  newId: () => string = () => crypto.randomUUID(),
): SetEntry[] {
  if (!(workingKg > 0)) return [];
  const sets =
    settings.warmupStrategy === 'none'
      ? []
      : training.generateWarmups(workingKg, settings.warmupStrategy, { barKg: settings.barWeightKg, roundToKg: ROUND_KG });
  if (sets.length > 0) return sets;
  const kg = Math.max(roundTo(workingKg * FALLBACK_WARMUP_RATIO, ROUND_KG), ROUND_KG);
  return [{ id: newId(), type: 'warmup', kg, reps: FALLBACK_WARMUP_REPS, done: false }];
}

/** Id of the set after `setId` in the exercise, if any. */
export function nextSetId(sets: readonly SetEntry[], setId: string): string | undefined {
  const i = sets.findIndex((s) => s.id === setId);
  return i >= 0 ? sets[i + 1]?.id : undefined;
}

/** 1-based number per kind: warm-ups count separately from working sets. */
export function setNumbers(sets: readonly SetEntry[]): number[] {
  let warm = 0;
  let work = 0;
  return sets.map((s) => (s.type === 'warmup' ? ++warm : ++work));
}

/** One display number: at most one decimal, no trailing zeros. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

let alerts: RestAlerts | null = null;
/** Shared alert channels (created lazily so SSR never touches browser APIs). */
export function restAlerts(): RestAlerts {
  alerts ??= createRestAlerts();
  return alerts;
}
