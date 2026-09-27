/** Retry/debounce timing and the persisted `lastSyncedAt`. */
import { LAST_SYNCED_KEY, type SyncStorage } from './cursors';

export const DEBOUNCE_MS = 1_500;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_CAP_MS = 300_000;

/** 2 s, 4 s, 8 s, … capped at 5 min, plus up to 10 % jitter. */
export function backoffDelay(attempt: number, random: () => number): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempt), BACKOFF_CAP_MS);
  return base + Math.floor(random() * base * 0.1);
}

export function readLastSynced(storage: SyncStorage): string | null {
  const v = storage.getItem(LAST_SYNCED_KEY);
  return v && Number.isFinite(Date.parse(v)) ? v : null;
}

export function writeLastSynced(storage: SyncStorage, iso: string): void {
  storage.setItem(LAST_SYNCED_KEY, iso);
}
