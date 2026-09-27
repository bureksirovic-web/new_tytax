'use client';
/**
 * Display names for pinned exercises that the catalog does not know (custom
 * exercises, retired catalog ids) and that may have no live log left. The
 * name snapshot of any log, soft-deleted ones included, is used; without one
 * the caller shows a "removed exercise" label. A raw exercise id is never a
 * display name.
 */
import type { WorkoutLog } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { useRepoQuery } from '@/hooks/use-repo';

/** The newest non-empty name snapshot of `exerciseId` in `logs` (newest first), never the id itself. */
export function snapshotNameOf(logs: readonly WorkoutLog[], exerciseId: string): string | undefined {
  for (const log of logs) {
    for (const ex of log.exercises) {
      const name = ex.exerciseId === exerciseId ? ex.exerciseName?.trim() : undefined;
      if (name && name !== exerciseId) return name;
    }
  }
  return undefined;
}

/** First usable candidate name (non-empty, not the raw id), else `removed`. */
export function pinnedDisplayName(id: string, candidates: ReadonlyArray<string | undefined>, removed: string): string {
  for (const c of candidates) if (c && c.trim() && c !== id) return c;
  return removed;
}

/** Snapshot names per pinned id, read from the profile's logs including soft-deleted ones. */
export async function readSnapshotNames(
  repo: Repository,
  profileId: string,
  ids: readonly string[],
): Promise<Record<string, string | undefined>> {
  const pairs = await Promise.all(
    ids.map(async (id) => {
      const logs = await repo.logs.historyFor(profileId, id, { includeDeleted: true, limit: 1 });
      return [id, snapshotNameOf(logs, id)] as const;
    }),
  );
  return Object.fromEntries(pairs);
}

/** Live hook form of `readSnapshotNames` ({} until loaded). */
export function useSnapshotNames(profileId: string | undefined, ids: readonly string[]): Record<string, string | undefined> {
  const key = ids.join('\n');
  const { data } = useRepoQuery(
    async (repo: Repository) => (profileId ? readSnapshotNames(repo, profileId, ids) : {}),
    // `key` stands in for `ids` by value.
    [profileId, key],
  );
  return data ?? {};
}
