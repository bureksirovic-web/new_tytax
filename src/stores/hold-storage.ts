/**
 * Stored starts of running hold timers (sessionStorage `tytax-hold:<setId>`),
 * written by the row's `useHoldTimer` (components/workout/hold-timer.ts).
 *
 * - `HOLD_STORAGE_PREFIX` → the key prefix.
 * - `clearHoldStarts(setIds?)` → removes the keys of those set ids, or every
 *   hold key when none are given. The workout store calls it when a set, an
 *   exercise or the whole draft goes away (refuter-2 F2), so no orphan hold
 *   outlives its set. Storage failures (private mode, blocked) are ignored.
 */
export const HOLD_STORAGE_PREFIX = 'tytax-hold:';

export function clearHoldStarts(setIds?: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const store = window.sessionStorage;
    const keys = setIds
      ? setIds.map((id) => HOLD_STORAGE_PREFIX + id)
      : Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => !!k && k.startsWith(HOLD_STORAGE_PREFIX));
    for (const key of keys) store.removeItem(key);
  } catch {
    // Nothing stored or storage blocked: nothing to clear.
  }
}
