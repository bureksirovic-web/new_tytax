/**
 * Bounds on what an import hands to the UI.
 *
 * A 20 MiB legacy file with one log of 511k invalid sets produced 511k
 * warnings (a 63 MiB result object) that the preview screen would render.
 * Results keep the first MAX_REPORTED_WARNINGS warnings plus one summary
 * warning per code for the rest, and the MAX_REPORTED_UNRESOLVED most
 * frequent unresolved names (with the full count reported separately).
 */
import type { UnresolvedExercise } from '../map/types';
import type { ServiceWarning } from './types';

export const MAX_REPORTED_WARNINGS = 200;
export const MAX_REPORTED_UNRESOLVED = 200;

/** First `max` warnings in order, then one `path: '(omitted)'` summary per code. */
export function capWarnings(warnings: readonly ServiceWarning[], max = MAX_REPORTED_WARNINGS): ServiceWarning[] {
  if (warnings.length <= max) return [...warnings];
  const kept = warnings.slice(0, max);
  const omitted = new Map<ServiceWarning['code'], number>();
  for (let i = max; i < warnings.length; i++) omitted.set(warnings[i].code, (omitted.get(warnings[i].code) ?? 0) + 1);
  for (const [code, n] of omitted) kept.push({ code, path: '(omitted)', message: `${n} more ${code} warning(s) not listed` });
  return kept;
}

/** The `max` most frequent names, returned in the input's order. */
export function capUnresolved(list: readonly UnresolvedExercise[], max = MAX_REPORTED_UNRESOLVED): UnresolvedExercise[] {
  if (list.length <= max) return [...list];
  const keep = new Set([...list].sort((a, b) => b.occurrences - a.occurrences).slice(0, max));
  return list.filter((u) => keep.has(u));
}
