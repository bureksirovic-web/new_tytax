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
 * Would this set beat a stored PR? Mirrors `training.detectPRs`, which only
 * produces `e1rm` and `weight` PRs. A first-ever record is a baseline, not a PR.
 */
export function usePRCheck(exerciseId: string, kg: number, reps: number) {
  const { best, isLoading } = usePR(exerciseId);
  if (isLoading || kg <= 0 || reps <= 0) return { isPR: false, prType: null };
  const weight = best.weight?.value;
  const e1rm = best.e1rm?.value;
  if (weight !== undefined && kg > weight) return { isPR: true, prType: 'weight' as const };
  if (e1rm !== undefined && training.e1rm(kg, reps) > e1rm) return { isPR: true, prType: 'e1rm' as const };
  return { isPR: false, prType: null };
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
