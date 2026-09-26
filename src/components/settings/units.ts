import type { Units } from '@/contracts/domain';

/** 1 kg = 2.20462 lb (weights are stored in kg; units only change display and input). */
export const LB_PER_KG = 2.20462;

/** kg → the value shown in `units`, rounded to one decimal. */
export function kgToUnits(kg: number, units: Units): number {
  const v = units === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(v * 10) / 10;
}

/** A value entered in `units` → kg (unrounded). */
export function unitsToKg(value: number, units: Units): number {
  return units === 'lb' ? value / LB_PER_KG : value;
}

/**
 * Parses a user-entered non-negative number ("80", "80.5", "80,5").
 * Empty input → null; anything else invalid → undefined.
 */
export function parseNonNegative(input: string): number | null | undefined {
  const s = input.trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
