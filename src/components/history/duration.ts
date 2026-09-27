/**
 * Time-measured sets (Wave 2, F2): a set with `durationSeconds` is a hold/carry/stretch.
 * The log records what was measured, so a set is a time set when it carries a duration
 * (an older kg×reps log of the same exercise stays kg×reps).
 */
import type { SetEntry } from '@/contracts/domain';

/** Largest value the mm:ss field can show: 99:59. */
export const MAX_DURATION_SECONDS = 99 * 60 + 59;

export function isTimeSet(s: SetEntry): boolean {
  return typeof s.durationSeconds === 'number' && Number.isFinite(s.durationSeconds);
}

/** Seconds as mm:ss, e.g. 90 → "01:30", 45 → "00:45". Negative/NaN render as "00:00". */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "m:ss" / "mm:ss" or plain seconds ("45") → seconds; null when not a clock value. */
export function parseClock(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d{1,4}$/.test(trimmed)) return Number(trimmed);
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
