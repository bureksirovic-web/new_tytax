import type { WorkoutLog } from '@/contracts/domain';
import { ACWR_THRESHOLDS } from '@/lib/constants';
import { historyWeeks } from '@/lib/training';
import { parseLocalDay } from '@/lib/utils';
import { dayCutoff, liveLogs, logVolume } from './sets';

export interface ACWRWorkoutResult {
  date: string;
  acute: number;
  chronic: number;
  ratio: number;
  zone: 'undertrain' | 'optimal' | 'caution' | 'danger';
  weeklyVolume: number;
}

export function getACWRZone(ratio: number): ACWRWorkoutResult['zone'] {
  if (ratio < ACWR_THRESHOLDS.UNDERTRAIN_MAX) return 'undertrain';
  if (ratio <= ACWR_THRESHOLDS.OPTIMAL_MAX) return 'optimal';
  if (ratio <= ACWR_THRESHOLDS.CAUTION_MAX) return 'caution';
  return 'danger';
}

export const ACWR_ZONE_COLORS: Record<ACWRWorkoutResult['zone'], string> = {
  undertrain: 'var(--text-muted)',
  optimal: 'var(--accent)',
  caution: 'var(--highlight)',
  danger: '#ef4444',
};

const DAY_MS = 86_400_000;

/** Σ volume over the `days` local calendar days ending on `day` (inclusive). */
function rollingSum(volumeByDate: ReadonlyMap<string, number>, day: string, days: number): number {
  const d = parseLocalDay(day);
  let total = 0;
  for (let i = 0; i < days; i++) total += volumeByDate.get(dayCutoff(d, i)) ?? 0;
  return total;
}

/** Whole local calendar days from `from` to `to` ('YYYY-MM-DD'; DST-safe). */
function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDay(to).getTime() - parseLocalDay(from).getTime()) / DAY_MS);
}

/** Monday of the local week containing `day`, 'YYYY-MM-DD'. */
function getWeekStart(day: string): string {
  const d = parseLocalDay(day);
  const dow = d.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  return dayCutoff(d, back);
}

/**
 * Session-level ACWR on daily volume (Σ kg × reps over done working sets of
 * live logs), both ending on the log's local day:
 * - acute = Σ volume over 7 days / 7 (kg/day);
 * - chronic = (Σ volume over 28 days / W) / 7 (kg/day), W = weeks of history
 *   = min(4, floor(days since the first day with volume / 7) + 1), the same
 *   rule as `training.acwr` (`historyWeeks`). A new user is compared with the
 *   weeks they actually trained, not an empty month: a first session gives
 *   ratio 1, not 4. Days without volume (warm-up-only or bodyweight-only
 *   logs) do not start history.
 * ratio = acute / chronic (1 when chronic is 0).
 */
export function computeACWR(logs: readonly WorkoutLog[]): ACWRWorkoutResult[] {
  const sorted = liveLogs(logs).sort((a, b) => a.date.localeCompare(b.date));

  const volumeByDate = new Map<string, number>();
  for (const log of sorted) {
    volumeByDate.set(log.date, (volumeByDate.get(log.date) ?? 0) + logVolume(log));
  }

  const weeklyVolume = new Map<string, number>();
  for (const [date, vol] of volumeByDate.entries()) {
    const wk = getWeekStart(date);
    weeklyVolume.set(wk, (weeklyVolume.get(wk) ?? 0) + vol);
  }

  // Dates sort lexicographically; `sorted` is ascending, so the first day with volume starts history.
  const firstLoadDay = sorted.find((log) => (volumeByDate.get(log.date) ?? 0) > 0)?.date;

  return sorted.map((log) => {
    // Age of history in whole local days, fed to the shared rule as a time span.
    const weeks =
      firstLoadDay !== undefined && firstLoadDay <= log.date
        ? historyWeeks(daysBetween(firstLoadDay, log.date) * DAY_MS, 0)
        : 1;
    const acute = rollingSum(volumeByDate, log.date, 7) / 7;
    const chronic = rollingSum(volumeByDate, log.date, 28) / weeks / 7;
    const ratio = chronic > 0 ? acute / chronic : 1.0;
    return {
      date: log.date,
      acute,
      chronic,
      ratio,
      zone: getACWRZone(ratio),
      weeklyVolume: weeklyVolume.get(getWeekStart(log.date)) ?? 0,
    };
  });
}
