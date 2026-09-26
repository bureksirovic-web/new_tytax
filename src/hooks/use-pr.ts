'use client';
import type { PRRecord, PRType } from '@/contracts/domain';
import type { PRCandidate } from '@/contracts/training';
import { training } from '@/lib/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';

export type BestPRs = Partial<Record<PRType, PRRecord>>;

const NO_PRS: BestPRs = {};

/** Best stored PR per type for one exercise of the active profile (live). */
export function usePR(exerciseId: string) {
  const { profileId } = useActiveProfile();
  const { data, loading, error } = useRepoQuery(
    (repo): Promise<BestPRs> =>
      profileId && exerciseId ? repo.prs.best(profileId, exerciseId) : Promise.resolve(NO_PRS),
    [profileId, exerciseId],
  );
  const best = data ?? NO_PRS;
  return {
    best,
    bestE1rm: best.e1rm?.value ?? 0,
    bestWeight: best.weight?.value ?? 0,
    bestReps: best.reps?.value ?? 0,
    bestVolume: best.volume?.value ?? 0,
    isLoading: loading,
    error,
  };
}

/**
 * e1RM PRs only from sets of at most this many reps: mirrors
 * `E1RM_PR_MAX_REPS` in G1's `detectPRs` (request G1-02; Brzycki diverges near
 * 37 reps, 16 kg × 35 → 288 kg).
 */
export const LIVE_E1RM_PR_MAX_REPS = 12;

export type LivePRCheck = { isPR: true; prType: 'e1rm' | 'weight' | 'reps' } | { isPR: false; prType: null };

/**
 * Would this set beat a stored PR? Pure mirror of `training.detectPRs`:
 * `e1rm` (reps ≤ 12), `weight` (kg > 0), and `reps` for sets at 0 kg
 * (bodyweight). Strictly greater than the stored best; with no stored best the
 * value is a baseline, never a PR.
 */
export function livePRCheck(best: BestPRs, kg: number, reps: number): LivePRCheck {
  if (!(reps > 0) || !(kg >= 0)) return { isPR: false, prType: null };
  const e1rm = best.e1rm?.value;
  const weight = best.weight?.value;
  const repsBest = best.reps?.value;
  if (kg > 0 && reps <= LIVE_E1RM_PR_MAX_REPS && e1rm !== undefined && training.e1rm(kg, reps) > e1rm) {
    return { isPR: true, prType: 'e1rm' };
  }
  if (kg > 0 && weight !== undefined && kg > weight) return { isPR: true, prType: 'weight' };
  if (kg === 0 && repsBest !== undefined && reps > repsBest) return { isPR: true, prType: 'reps' };
  return { isPR: false, prType: null };
}

/** `livePRCheck` against the active profile's stored bests (false while loading). */
export function usePRCheck(exerciseId: string, kg: number, reps: number): LivePRCheck {
  const { best, isLoading } = usePR(exerciseId);
  if (isLoading) return { isPR: false, prType: null };
  return livePRCheck(best, kg, reps);
}

const PR_TYPE_ORDER: Record<PRType, number> = { e1rm: 0, weight: 1, reps: 2, volume: 3 };

/**
 * PRs worth celebrating after `finishWorkout`: non-baseline records only
 * (a first-ever record is stored, never celebrated), in session order, and
 * within one exercise e1rm → weight → reps → volume. Pure; no repository.
 */
export function celebratedPRs(prs: readonly PRCandidate[] | undefined): PRCandidate[] {
  const list = (prs ?? []).filter((p) => !p.isBaseline);
  const firstSeen = new Map<string, number>();
  list.forEach((p, i) => {
    if (!firstSeen.has(p.exerciseId)) firstSeen.set(p.exerciseId, i);
  });
  return list
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        (firstSeen.get(a.p.exerciseId) ?? 0) - (firstSeen.get(b.p.exerciseId) ?? 0) ||
        PR_TYPE_ORDER[a.p.prType] - PR_TYPE_ORDER[b.p.prType] ||
        a.i - b.i,
    )
    .map(({ p }) => p);
}
