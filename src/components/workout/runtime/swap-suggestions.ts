/**
 * Exercise swap ranking. Contract-agnostic: callers supply accessors.
 *
 * - query longer than 2 chars -> name search (case/diacritic-insensitive)
 * - otherwise candidates sharing muscle OR pattern with the target; both
 *   first, then muscle only, then pattern only, then A-Z by name.
 * - the target itself is always excluded; `isAvailable` filters inventory.
 */

export interface SwapAccessors<T> {
  getId: (ex: T) => string;
  getName: (ex: T) => string;
  getMuscle: (ex: T) => string | null | undefined;
  getPattern: (ex: T) => string | null | undefined;
  isAvailable?: (ex: T) => boolean;
  query?: string | null;
  limit?: number;
}

/** Lowercase, strip diacritics (incl. đ/ł/ø/ß), collapse whitespace. */
export function foldText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareNames(a: string, b: string): number {
  const fa = foldText(a);
  const fb = foldText(b);
  if (fa < fb) return -1;
  if (fa > fb) return 1;
  return a.localeCompare(b);
}

function applyLimit<T>(list: T[], limit: number | undefined): T[] {
  if (limit === undefined || !Number.isFinite(limit)) return list;
  return list.slice(0, Math.max(0, Math.floor(limit)));
}

export function rankSwapCandidates<T>(
  target: T,
  all: readonly T[],
  opts: SwapAccessors<T>,
): T[] {
  const { getId, getName, getMuscle, getPattern, isAvailable, limit } = opts;
  const targetId = getId(target);
  const pool = all.filter(
    (ex) => getId(ex) !== targetId && (!isAvailable || isAvailable(ex)),
  );

  const query = foldText(opts.query);
  if (query.length > 2) {
    const hits = pool
      .map((ex) => ({ ex, name: foldText(getName(ex)) }))
      .filter((h) => h.name.includes(query))
      .sort(
        (a, b) =>
          Number(b.name.startsWith(query)) - Number(a.name.startsWith(query)) ||
          compareNames(getName(a.ex), getName(b.ex)),
      )
      .map((h) => h.ex);
    return applyLimit(hits, limit);
  }

  const muscle = foldText(getMuscle(target));
  const pattern = foldText(getPattern(target));
  const scored: { ex: T; rank: number }[] = [];
  for (const ex of pool) {
    const sameMuscle = muscle !== '' && foldText(getMuscle(ex)) === muscle;
    const samePattern = pattern !== '' && foldText(getPattern(ex)) === pattern;
    if (!sameMuscle && !samePattern) continue;
    const rank = sameMuscle && samePattern ? 0 : sameMuscle ? 1 : 2;
    scored.push({ ex, rank });
  }
  scored.sort(
    (a, b) => a.rank - b.rank || compareNames(getName(a.ex), getName(b.ex)),
  );
  return applyLimit(
    scored.map((s) => s.ex),
    limit,
  );
}
