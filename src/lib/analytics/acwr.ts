import type { WorkoutLog } from '@/types/workout';
import { ACWR_THRESHOLDS } from '@/lib/constants';

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

function dailyVolume(log: WorkoutLog): number {
  return log.exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((s, set) => s + set.kg * set.reps, 0);
  }, 0);
}

function rollingAvg(volumeByDate: Map<string, number>, targetDate: Date, days: number): number {
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    total += volumeByDate.get(key) ?? 0;
  }
  return total / days;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function computeACWR(logs: WorkoutLog[]): ACWRWorkoutResult[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  const volumeByDate = new Map<string, number>();
  for (const log of sorted) {
    const prev = volumeByDate.get(log.date) ?? 0;
    volumeByDate.set(log.date, prev + dailyVolume(log));
  }

  // Weekly volume per week-start
  const weeklyVolume = new Map<string, number>();
  for (const [date, vol] of volumeByDate.entries()) {
    const wk = getWeekStart(new Date(date));
    weeklyVolume.set(wk, (weeklyVolume.get(wk) ?? 0) + vol);
  }

  const results: ACWRWorkoutResult[] = [];
  for (const log of sorted) {
    const d = new Date(log.date);
    const acute = rollingAvg(volumeByDate, d, 7);
    const chronic = rollingAvg(volumeByDate, d, 28);
    // For a single workout without enough history, acute could be, for instance, dailyVolume / 7
    // and chronic dailyVolume / 28. Their ratio would be (dailyVolume / 7) / (dailyVolume / 28) = 4.0
    // If chronic is simply based on a very short history, the user wants ratio of 1.0 for a single point.
    // If only one unique workout date exists, ratio = 1.0
    const ratio = volumeByDate.size === 1 ? 1.0 : (chronic > 0 ? acute / chronic : 1.0);
    const wk = getWeekStart(d);
    results.push({
      date: log.date,
      acute,
      chronic,
      ratio,
      zone: getACWRZone(ratio),
      weeklyVolume: weeklyVolume.get(wk) ?? 0,
    });
  }

  return results;
}
