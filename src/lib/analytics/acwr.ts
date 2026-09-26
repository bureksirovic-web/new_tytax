import type { WorkoutLog } from '@/contracts/domain';
import { ACWR_THRESHOLDS } from '@/lib/constants';
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

/** Mean daily volume over the `days` local calendar days ending on `day` (inclusive). */
function rollingAvg(volumeByDate: ReadonlyMap<string, number>, day: string, days: number): number {
  const d = parseLocalDay(day);
  let total = 0;
  for (let i = 0; i < days; i++) total += volumeByDate.get(dayCutoff(d, i)) ?? 0;
  return total / days;
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
 * live logs): acute = mean daily volume over 7 days, chronic = over 28 days,
 * both ending on the log's local day. A single training day → ratio 1.
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

  return sorted.map((log) => {
    const acute = rollingAvg(volumeByDate, log.date, 7);
    const chronic = rollingAvg(volumeByDate, log.date, 28);
    const ratio = volumeByDate.size === 1 ? 1.0 : chronic > 0 ? acute / chronic : 1.0;
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
