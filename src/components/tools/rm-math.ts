/**
 * Pure one-rep-max math. The estimate is the app-wide `training.e1rm`
 * (contract: Brzycki `kg × 36 / (37 − reps)` up to 36 reps, Epley
 * `kg × (1 + reps / 30)` from 37), so the calculator agrees with PRs and
 * history. Brzycki grows fast past ~12 reps, so the UI flags those
 * estimates as unreliable (`UNRELIABLE_ABOVE_REPS`).
 */
import { training } from '@/lib/training';

export const PERCENTAGES: readonly number[] = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
export const REP_RANGE_MAX = 12;
/** Same switch point as `training.e1rm`. */
const EPLEY_FROM_REPS = 37;
/** Estimates from more reps than this get the "unreliable" hint. */
export const UNRELIABLE_ABOVE_REPS = 12;
/** The UI rejects rep counts above this; estimates past it are meaningless. */
export const MAX_REPS = 30;

function isPositive(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function roundTo(value: number, step: number): number {
  // Round in step units, then fix float noise such as 107.50000000000001.
  return Number((Math.round(value / step) * step).toFixed(4));
}

/** Estimated 1RM (unrounded) via `training.e1rm`; reps are floored. Returns 0 for invalid input. */
export function brzycki(weight: number, reps: number): number {
  if (!isPositive(weight) || !isPositive(reps)) return 0;
  const r = Math.floor(reps);
  if (r < 1) return 0;
  return training.e1rm(weight, r);
}

/** True when an estimate from `reps` reps should carry the unreliable hint. */
export function isUnreliableReps(reps: number): boolean {
  return Number.isFinite(reps) && Math.floor(reps) > UNRELIABLE_ABOVE_REPS;
}

/** 1RM rounded to 0.5 kg for display. */
export function estimate1RM(weight: number, reps: number): number {
  return roundTo(brzycki(weight, reps), 0.5);
}

export interface PercentRow {
  percent: number;
  kg: number;
}

/** 100%..50% of the 1RM in steps of 5, each rounded to 2.5 kg. */
export function percentTable(oneRmKg: number): PercentRow[] {
  if (!isPositive(oneRmKg)) return [];
  return PERCENTAGES.map((percent) => ({
    percent,
    kg: roundTo((oneRmKg * percent) / 100, 2.5),
  }));
}

export interface RepMaxRow {
  reps: number;
  kg: number;
}

/** Inverse of brzycki(): weight you can lift for `reps` given a 1RM. */
export function repMaxWeight(oneRmKg: number, reps: number): number {
  if (!isPositive(oneRmKg) || !isPositive(reps)) return 0;
  const r = Math.floor(reps);
  if (r < 1) return 0;
  if (r === 1) return oneRmKg;
  if (r >= EPLEY_FROM_REPS) return (oneRmKg * 30) / (30 + r);
  return (oneRmKg * (37 - r)) / 36;
}

/** 1..12 rep maxes, each rounded to 2.5 kg. */
export function repMaxTable(oneRmKg: number): RepMaxRow[] {
  if (!isPositive(oneRmKg)) return [];
  return Array.from({ length: REP_RANGE_MAX }, (_, i) => ({
    reps: i + 1,
    kg: roundTo(repMaxWeight(oneRmKg, i + 1), 2.5),
  }));
}
