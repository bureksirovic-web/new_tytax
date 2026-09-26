/** Small pure helpers shared by the v2 -> v3 transforms. */
import type { Modality } from '@/contracts';

const MODALITIES: readonly Modality[] = ['tytax', 'bodyweight', 'kettlebell', 'custom'];

/** Unknown / legacy modality strings become `'custom'` (case-insensitive match first). */
export function toModality(value: unknown): Modality {
  if (typeof value !== 'string') return 'custom';
  const lower = value.trim().toLowerCase();
  return MODALITIES.find((m) => m === lower) ?? 'custom';
}

/** Coerced, de-duplicated, first-appearance order. */
export function toModalities(values: readonly unknown[]): Modality[] {
  return [...new Set(values.map(toModality))];
}

/** Finite number or the fallback. */
export function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** RIR clamped to 0–5; undefined when absent or not a finite number. */
export function clampRir(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(5, Math.max(0, value));
}

/** Integer index clamped into `[0, length - 1]` (0 when empty or invalid). */
export function clampIndex(value: unknown, length: number): number {
  if (length <= 0) return 0;
  const n = Math.trunc(finiteOr(value, 0));
  return Math.min(length - 1, Math.max(0, n));
}

/** Copy without `undefined`-valued keys, so rows stay JSON round-trip stable. */
export function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** A non-empty string or the fallback. */
export function strOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

/** Stable ascending comparator on string ids. */
export function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Fallback stamp for rows with no usable timestamp and no caller-supplied `now`. */
export const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * ISO-8601 UTC timestamp in `toISOString()` shape. v2 wrote many stamps with
 * `isoDate()` ('YYYY-MM-DD'); those become midnight UTC of that day. A valid
 * datetime is normalised to UTC milliseconds; anything else is the fallback.
 */
export function coerceTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  const candidate = DATE_ONLY.test(v) ? `${v}T00:00:00.000Z` : DATE_TIME.test(v) ? v : null;
  if (candidate === null) return fallback;
  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) return fallback;
  // Reject overflowed days ('2026-02-30' would roll into March).
  if (candidate.endsWith('Z') && new Date(ms).toISOString().slice(0, 10) !== v.slice(0, 10)) return fallback;
  return new Date(ms).toISOString();
}

/** Calendar day 'YYYY-MM-DD' (a datetime keeps its date part); undefined when unusable. */
export function coerceCalendarDay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const day = value.trim().slice(0, 10);
  if (!DATE_ONLY.test(day)) return undefined;
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === day ? day : undefined;
}
