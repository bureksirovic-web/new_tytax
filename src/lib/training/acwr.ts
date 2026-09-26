import type { ACWRResult, ACWRStatus } from '@/contracts/domain';
import type { AcwrFn } from '@/contracts/training';
import { DAY_MS, addLogLoad, clean, liveLogs, logTime } from './common';

/**
 * ACWR thresholds (acute:chronic workload ratio, Gabbett's "sweet spot"
 * 0.8–1.3 widened to 1.5 for home training):
 * - ratio > 1.5 → `fried` (spike, injury risk);
 * - ratio < 0.8 → `fresh` (under-loaded vs the last 4 weeks);
 * - otherwise → `recovering` (productive load).
 * Trend: acute load vs the 7 days before it; within ±10 % is `stable`.
 */
export const ACWR_FRIED_ABOVE = 1.5;
export const ACWR_FRESH_BELOW = 0.8;
export const ACWR_TREND_BAND = 0.1;

function statusFor(ratio: number): ACWRStatus {
  if (ratio > ACWR_FRIED_ABOVE) return 'fried';
  if (ratio < ACWR_FRESH_BELOW) return 'fresh';
  return 'recovering';
}

function trendFor(acute: number, previous: number): ACWRResult['trend'] {
  if (previous <= 0) return acute > 0 ? 'rising' : 'stable';
  if (acute > previous * (1 + ACWR_TREND_BAND)) return 'rising';
  if (acute < previous * (1 - ACWR_TREND_BAND)) return 'falling';
  return 'stable';
}

function addInto(target: Map<string, number>, src: ReadonlyMap<string, number>): void {
  for (const [m, v] of src) target.set(m, (target.get(m) ?? 0) + v);
}

/**
 * Weeks of training history at `nowMs`: min(4, floor(age / 7 d) + 1), where
 * age = time since the earliest load-bearing session. Same week (age < 7 d)
 * → 1; a session exactly 7 d ago → 2; 22 d → 4 (floor 3 + 1). No history → 1.
 */
export function historyWeeks(nowMs: number, earliestMs: number): number {
  if (!Number.isFinite(earliestMs) || earliestMs > nowMs) return 1;
  return Math.min(4, Math.floor((nowMs - earliestMs) / (7 * DAY_MS)) + 1);
}

/**
 * Acute:chronic workload per muscle. Load = Σ score/100 over done working
 * sets (see `impactDistribution`), placed at the log's end time.
 * acute = load in (now − 7 d, now]; chronic = load in (now − 28 d, now] / W
 * (mean weekly load), where W = `historyWeeks` = min(4, floor((now −
 * earliest) / 7 d) + 1) and earliest = end time of the first live log at or
 * before now that carried load (≥ 1 done working set of an exercise with
 * impact; an empty or warm-up-only log does not extend history). A new user
 * is therefore compared with the weeks they actually trained, not with an
 * empty month (one session → ratio 1, not 4). ratio = acute / chronic (0
 * when chronic is 0).
 * Only muscles with load in the last 28 days are listed, sorted by acute
 * load desc, then name.
 */
export const acwr: AcwrFn = (logs, lookup, now) => {
  const nowMs = now.getTime();
  const acute = new Map<string, number>();
  const previous = new Map<string, number>();
  const chronicSum = new Map<string, number>();
  let earliest = Infinity;
  for (const log of liveLogs(logs)) {
    const t = logTime(log);
    if (Number.isNaN(t) || t > nowMs) continue;
    const inWindow = t > nowMs - 28 * DAY_MS;
    // Older logs matter only as the start of history; skip their load when they cannot move it.
    if (!inWindow && t >= earliest) continue;
    const perLog = addLogLoad(log, lookup, new Map());
    if (perLog.size === 0) continue;
    if (t < earliest) earliest = t;
    if (!inWindow) continue;
    addInto(chronicSum, perLog);
    if (t > nowMs - 7 * DAY_MS) addInto(acute, perLog);
    else if (t > nowMs - 14 * DAY_MS) addInto(previous, perLog);
  }
  const weeks = historyWeeks(nowMs, earliest);
  const out: ACWRResult[] = [];
  for (const [muscle, sum] of chronicSum) {
    const acuteLoad = clean(acute.get(muscle) ?? 0);
    const chronicLoad = clean(sum / weeks);
    const ratio = chronicLoad > 0 ? clean(acuteLoad / chronicLoad) : 0;
    out.push({
      muscle,
      acuteLoad,
      chronicLoad,
      ratio,
      status: statusFor(ratio),
      trend: trendFor(acuteLoad, previous.get(muscle) ?? 0),
    });
  }
  out.sort((a, b) => b.acuteLoad - a.acuteLoad || a.muscle.localeCompare(b.muscle));
  return out;
};
