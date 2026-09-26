/**
 * Pure plate-loading math for a barbell / TYTAX lever.
 * All arithmetic runs in integer grams so 1.25 kg plates never drift.
 */

export const DEFAULT_PLATES_KG: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_BAR_KG = 20;

export interface CalcPlatesInput {
  targetKg: number;
  barKg?: number;
  plates?: readonly number[];
  /** Pairs available per plate size (kg -> pairs). Missing size = unlimited. */
  pairsAvailable?: Readonly<Record<number, number>>;
}

export interface CalcPlatesResult {
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** Bar + both sides actually loaded. */
  loadedKg: number;
  /** targetKg - loadedKg (negative when target is below the bar). */
  remainderKg: number;
  /** True only when loadedKg equals targetKg exactly. */
  achievable: boolean;
}

const toGrams = (kg: number): number => Math.round(kg * 1000);
const toKg = (g: number): number => g / 1000;

function isValidWeight(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Targets above this are rejected as invalid input (keeps the search bounded). */
export const MAX_TARGET_KG = 1000;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Heaviest-first plate list for one side whose sum is the largest value <= sideG.
 * Memoised search over (plate index, grams left): exact whenever an exact
 * combination exists, otherwise the nearest lower load. Counts come from
 * division, never one loop turn per plate.
 */
function bestSide(sizesG: readonly number[], maxCounts: readonly number[], sideG: number): number[] {
  // tailGcd[i] = gcd of sizes i..end; any reachable sum from i is a multiple of it.
  const tailGcd = sizesG.map((_, i) => sizesG.slice(i).reduce(gcd, 0));
  const memo = new Map<string, number>();

  const best = (i: number, left: number): number => {
    if (i >= sizesG.length || left <= 0) return 0;
    const key = `${i}:${left}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const size = sizesG[i];
    const ceiling = Math.floor(left / tailGcd[i]) * tailGcd[i];
    let top = 0;
    for (let n = Math.min(maxCounts[i], Math.floor(left / size)); n >= 0; n -= 1) {
      const sum = n * size + best(i + 1, left - n * size);
      if (sum > top) top = sum;
      if (top === ceiling) break;
    }
    memo.set(key, top);
    return top;
  };

  const out: number[] = [];
  let left = sideG;
  let goal = best(0, left);
  for (let i = 0; i < sizesG.length && goal > 0; i += 1) {
    const size = sizesG[i];
    for (let n = Math.min(maxCounts[i], Math.floor(left / size)); n >= 0; n -= 1) {
      if (n * size + best(i + 1, left - n * size) === goal) {
        for (let k = 0; k < n; k += 1) out.push(size);
        left -= n * size;
        goal -= n * size;
        break;
      }
    }
  }
  return out;
}

const EMPTY: CalcPlatesResult = { perSide: [], loadedKg: 0, remainderKg: 0, achievable: false };

export function calcPlates({
  targetKg,
  barKg = DEFAULT_BAR_KG,
  plates = DEFAULT_PLATES_KG,
  pairsAvailable,
}: CalcPlatesInput): CalcPlatesResult {
  if (!isValidWeight(targetKg) || targetKg <= 0 || targetKg > MAX_TARGET_KG) return { ...EMPTY };
  if (!isValidWeight(barKg) || barKg < 0) return { ...EMPTY };

  const targetG = toGrams(targetKg);
  const barG = toGrams(barKg);

  if (targetG < barG) {
    return {
      perSide: [],
      loadedKg: toKg(barG),
      remainderKg: toKg(targetG - barG),
      achievable: false,
    };
  }

  const sizesG = Array.from(
    new Set(plates.filter((p) => isValidWeight(p) && p > 0).map(toGrams)),
  )
    .filter((g) => g > 0)
    .sort((a, b) => b - a);
  const maxCounts = sizesG.map((g) => {
    const pairs = pairsAvailable?.[toKg(g)];
    return pairs === undefined ? Infinity : Math.max(0, Math.floor(pairs));
  });

  // Each side takes half of what is above the bar; an odd gram cannot be split.
  const perSideG = bestSide(sizesG, maxCounts, Math.floor((targetG - barG) / 2));

  const sideG = perSideG.reduce((sum, g) => sum + g, 0);
  const loadedG = barG + 2 * sideG;

  return {
    perSide: perSideG.map(toKg),
    loadedKg: toKg(loadedG),
    remainderKg: toKg(targetG - loadedG),
    achievable: loadedG === targetG,
  };
}

/** Parse a user-typed weight; accepts a comma as the decimal separator (hr locale). */
export function parseWeightInput(raw: string): number {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '' || !/^-?\d*\.?\d*$/.test(trimmed)) return NaN;
  return Number(trimmed);
}
