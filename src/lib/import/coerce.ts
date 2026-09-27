/** Small pure coercion helpers shared by the normalizers. */

/** Same normalization the legacy app applied to exercise/plan names (legacy index.html ~6129). */
export function normalizeName(name: string): string {
  return name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export type Numeric = number | 'blank' | 'invalid';

const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Legacy numbers were often strings from <input> fields.
 * - finite number -> itself
 * - '', whitespace, null, undefined -> 'blank'
 * - "82.5" / "82,5" (Croatian decimal comma) -> 82.5
 * - anything else -> 'invalid'
 */
export function parseNumeric(value: unknown): Numeric {
  if (value === null || value === undefined) return 'blank';
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'invalid';
  if (typeof value !== 'string') return 'invalid';
  const s = value.trim();
  if (s === '') return 'blank';
  const normalized = s.replace(',', '.');
  if (!NUMERIC_RE.test(normalized)) return 'invalid';
  const n = Number(normalized);
  // A long digit string ('9'.repeat(400)) overflows to Infinity.
  return Number.isFinite(n) ? n : 'invalid';
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Strict ISO datetime: real hours 00-23, optional seconds/fraction, optional Z or ±hh:mm. */
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

/** Largest magnitude a JS Date can hold (ECMA-262 time value range). */
const MAX_TIME_MS = 8.64e15;

/** ISO string for an epoch-ms value, or undefined when it is not a representable Date. */
export function safeIso(ms: number): string | undefined {
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_TIME_MS) return undefined;
  return new Date(ms).toISOString();
}

function isRealDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export interface NormalizedDate {
  date: string;
  /** Present when the input carried a time of day. */
  iso?: string;
}

/**
 * Accepts 'YYYY-MM-DD' or a strict ISO datetime. Returns null for anything else,
 * including impossible calendar days in either form.
 * An offset-less datetime is read as UTC, so the result never depends on the
 * host time zone (Date.parse would treat it as local time).
 */
export function normalizeDate(value: string): NormalizedDate | null {
  const s = value.trim();
  const m = DATE_RE.exec(s);
  if (m) {
    return isRealDate(Number(m[1]), Number(m[2]), Number(m[3])) ? { date: s } : null;
  }
  const dt = DATETIME_RE.exec(s);
  if (!dt || !isRealDate(Number(dt[1]), Number(dt[2]), Number(dt[3]))) return null;
  const iso = safeIso(Date.parse(dt[5] === undefined ? `${s}Z` : s));
  if (iso === undefined) return null;
  // Keep the calendar day as written (the legacy app stored the local day).
  return { date: s.slice(0, 10), iso };
}

/** 2015-01-01 .. 2100-01-01: the range in which a numeric legacy id is a Date.now() stamp. */
const EPOCH_MIN = 1420070400000;
const EPOCH_MAX = 4102444800000;

export function epochMsFromId(id: unknown): number | undefined {
  const n = typeof id === 'string' && /^\d{13}$/.test(id) ? Number(id) : id;
  if (typeof n !== 'number' || !Number.isInteger(n)) return undefined;
  return n >= EPOCH_MIN && n < EPOCH_MAX ? n : undefined;
}

export function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
