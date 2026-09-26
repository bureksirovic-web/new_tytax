/**
 * Pure one-rep-max math. Brzycki for 1..10 reps, Epley from 11 reps up.
 * The two formulas meet near 10 reps (133.37 vs 133.33 for 100 kg), so the
 * switch keeps the estimate rising with reps; Brzycki alone explodes past
 * ~20 reps and its denominator hits zero at 37.
 */

export const PERCENTAGES: readonly number[] = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
export const REP_RANGE_MAX = 12;
const BRZYCKI_MAX_REPS = 10;
/** The UI rejects rep counts above this; estimates past it are meaningless. */
export const MAX_REPS = 30;

function isPositive(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function roundTo(value: number, step: number): number {
  // Round in step units, then fix float noise such as 107.50000000000001.
  return Number((Math.round(value / step) * step).toFixed(4));
}

/** Estimated 1RM (unrounded). Returns 0 for invalid input. */
export function brzycki(weight: number, reps: number): number {
  if (!isPositive(weight) || !isPositive(reps)) return 0;
  const r = Math.floor(reps);
  if (r < 1) return 0;
  if (r === 1) return weight;
  if (r > BRZYCKI_MAX_REPS) return weight * (1 + r / 30);
  return weight / (1.0278 - 0.0278 * r);
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
  if (r > BRZYCKI_MAX_REPS) return oneRmKg / (1 + r / 30);
  return oneRmKg * (1.0278 - 0.0278 * r);
}

/** 1..12 rep maxes, each rounded to 2.5 kg. */
export function repMaxTable(oneRmKg: number): RepMaxRow[] {
  if (!isPositive(oneRmKg)) return [];
  return Array.from({ length: REP_RANGE_MAX }, (_, i) => ({
    reps: i + 1,
    kg: roundTo(repMaxWeight(oneRmKg, i + 1), 2.5),
  }));
}
