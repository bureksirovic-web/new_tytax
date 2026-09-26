'use client';
import type { PRRecord, PRType } from '@/contracts/domain';
import type { PRCandidate } from '@/contracts/training';
import { isTimeSet, rankableE1rm } from '@/lib/training';
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

export type LivePRCheck = { isPR: true; prType: 'e1rm' | 'weight' | 'reps' } | { isPR: false; prType: null };

/**
 * Would this set beat a stored PR? Pure mirror of `training.detectPRs`:
 * a time set (`isTimeSet`: `durationSeconds` > 0) is never a candidate;
 * `e1rm` only through `rankableE1rm` (reps ≤ `E1RM_MAX_REPS`, kg > 0),
 * `weight` (kg > 0), and `reps` for sets at 0 kg (bodyweight). Strictly
 * greater than the stored best; with no stored best the value is a baseline,
 * never a PR.
 */
export function livePRCheck(best: BestPRs, kg: number, reps: number, durationSeconds?: number): LivePRCheck {
  if (isTimeSet({ durationSeconds }) || !(reps > 0) || !(kg >= 0)) return { isPR: false, prType: null };
  const e1rm = best.e1rm?.value;
  const weight = best.weight?.value;
  const repsBest = best.reps?.value;
  const est = rankableE1rm({ kg, reps, durationSeconds, done: true, type: 'working' });
  if (est !== undefined && e1rm !== undefined && est > e1rm) return { isPR: true, prType: 'e1rm' };
  if (kg > 0 && weight !== undefined && kg > weight) return { isPR: true, prType: 'weight' };
  if (kg === 0 && repsBest !== undefined && reps > repsBest) return { isPR: true, prType: 'reps' };
  return { isPR: false, prType: null };
}

/** `livePRCheck` against the active profile's stored bests (false while loading). */
export function usePRCheck(exerciseId: string, kg: number, reps: number, durationSeconds?: number): LivePRCheck {
  const { best, isLoading } = usePR(exerciseId);
  if (isLoading) return { isPR: false, prType: null };
  return livePRCheck(best, kg, reps, durationSeconds);
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
