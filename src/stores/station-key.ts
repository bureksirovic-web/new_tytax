/**
 * Station-id normalisation for the inventory match (weak point, swap sheet).
 * Ordering by station is G1's `orderByStation` (`@/lib/workout/order-by-station`),
 * which compares catalog `stationId`s exactly; this helper only makes the
 * inventory check tolerant of older id spellings a stored inventory may carry
 * (wave-0 'back-upper', display names such as 'Back Upper Pulley'), see
 * request G3-W2-05.
 */
import type { Exercise } from '@/contracts/domain';

const ALIASES: Readonly<Record<string, string>> = {
  SMITH_MACHINE: 'SMITH',
  BACK_UPPER_PULLEY: 'BACK_UPPER',
  BACK_LOWER_PULLEY: 'BACK_LOWER',
  FREE_WEIGHTS: 'FREE_WEIGHT',
};

/** Canonical station key ('back-upper' → 'BACK_UPPER'), or undefined for no station. */
export function stationKey(station: string | undefined | null): string | undefined {
  if (typeof station !== 'string') return undefined;
  const key = station.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return undefined;
  return ALIASES[key] ?? key;
}

/** The exercise's canonical station: `stationId`, else the display `station`. */
export function exerciseStationKey(ex: Pick<Exercise, 'stationId' | 'station'> | undefined): string | undefined {
  return stationKey(ex?.stationId || ex?.station);
}
