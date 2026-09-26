/**
 * PR-row counts of a legacy import (G3-02).
 *
 * The recompute itself is not here: repo.importBackup re-derives the whole
 * live history of every profile whose logs it wrote (rebuildPRsFrom in
 * src/lib/db/repo/prs.ts, same transaction, finishWorkout's rules). The
 * service only reports what that did, by diffing the profile's PR rows read
 * before and after the write:
 * - inserted: an id that did not exist before;
 * - updated: an existing row that was rewritten (a tombstone included);
 * - skipped: a row that was live before and is byte-identical after.
 * Rows already soft-deleted before and untouched are not counted.
 */
import type { PRRecord } from '@/contracts';
import { sameRow } from '@/lib/db/repo/tables';
import type { ImportCounts } from './types';

export function prDiff(before: readonly PRRecord[], after: readonly PRRecord[]): ImportCounts {
  const old = new Map(before.map((r) => [r.id, r]));
  const counts: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };
  for (const row of after) {
    const prev = old.get(row.id);
    if (prev === undefined) counts.inserted += 1;
    else if (!sameRow(row, prev)) counts.updated += 1;
    else if (!prev.deletedAt) counts.skipped += 1;
  }
  return counts;
}
