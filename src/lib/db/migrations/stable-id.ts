/**
 * Deterministic uuid-shaped ids for rows the migration has to re-key.
 *
 * User-data ids are uuids (contracts/domain.ts), but some v2 rows used a
 * catalog slug as their primary key (arsenal). A random uuid would give the
 * same v2 row a new id on every re-run; this hash gives the same input the
 * same id, so the migration stays idempotent. 128 bits from four independent
 * 32-bit FNV-1a/murmur-mixed lanes, stamped with the RFC 4122 v4 version and
 * variant bits so every uuid validator (and Postgres `uuid`) accepts it.
 */

function lane(input: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // murmur3 fmix32: spread the last characters over every bit.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const SEEDS = [0x9e3779b9, 0x7f4a7c15, 0x94d049bb, 0xbf58476d] as const;

/** Same `parts` -> same uuid; parts are length-prefixed so ('ab','c') differs from ('a','bc'). */
export function stableUuid(...parts: readonly string[]): string {
  const input = parts.map((p) => `${p.length}:${p}`).join('|');
  const hex = SEEDS.map((seed) => lane(input, seed).toString(16).padStart(8, '0')).join('');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
