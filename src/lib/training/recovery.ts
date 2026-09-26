import type { MuscleRecovery, RecoveryState, RecoveryStatusFn } from '@/contracts/training';
import { HOUR_MS, addLogLoad, clean, liveLogs, logTime } from './common';

/** Window measured back from `now`, in hours. */
export const RECOVERY_WINDOW_HOURS = 48;
/** load48h (impact-weighted done working sets) at or above this → fried. */
export const RECOVERY_FRIED_LOAD = 6;

const RANK: Readonly<Record<RecoveryState, number>> = { fresh: 0, recovering: 1, fried: 2 };

function stateFor(load48h: number): RecoveryState {
  if (load48h >= RECOVERY_FRIED_LOAD) return 'fried';
  if (load48h > 0) return 'recovering';
  return 'fresh';
}

/**
 * Per-muscle recovery. `load48h` sums score/100 over done working sets from
 * logs that ended (`finishedAt`, fallback `startedAt`) within
 * [now − 48 h, now], by timestamp — not by calendar day, so a session 47 h
 * ago counts and 49 h ago does not, across midnight. `lastTrainedAt` and
 * `hoursSince` come from every non-deleted log up to `now`. Muscles are
 * sorted by load48h desc, then name. `overall` is the worst state.
 */
export const recoveryStatus: RecoveryStatusFn = (logs, lookup, now) => {
  const nowMs = now.getTime();
  const fromMs = nowMs - RECOVERY_WINDOW_HOURS * HOUR_MS;
  const last = new Map<string, number>();
  const load = new Map<string, number>();
  for (const log of liveLogs(logs)) {
    const t = logTime(log);
    if (Number.isNaN(t) || t > nowMs) continue;
    const perLog = addLogLoad(log, lookup, new Map());
    for (const muscle of perLog.keys()) {
      const prev = last.get(muscle);
      if (prev === undefined || t > prev) last.set(muscle, t);
    }
    if (t >= fromMs) {
      for (const [muscle, v] of perLog) load.set(muscle, (load.get(muscle) ?? 0) + v);
    }
  }
  const muscles: MuscleRecovery[] = [...last.entries()].map(([muscle, ms]) => {
    const load48h = clean(load.get(muscle) ?? 0);
    return {
      muscle,
      status: stateFor(load48h),
      lastTrainedAt: new Date(ms).toISOString(),
      hoursSince: clean((nowMs - ms) / HOUR_MS),
      load48h,
    };
  });
  muscles.sort((a, b) => b.load48h - a.load48h || a.muscle.localeCompare(b.muscle));
  let overall: RecoveryState = 'fresh';
  for (const m of muscles) if (RANK[m.status] > RANK[overall]) overall = m.status;
  return { overall, muscles };
};
