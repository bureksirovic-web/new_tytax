/**
 * One live row per natural key. `exerciseNotes` and `arsenal` are keyed by
 * (profileId, exerciseId) in the contract (NotesRepo.set upserts,
 * ArsenalRepo.has/add), but row ids are per device: a note written here and
 * the "same" note restored from another device's backup (or pulled from
 * sync) carry different ids. Without a guard both stay live.
 *
 * Resolution (importBackup and applyRemote share it):
 * - Among the live rows for one key, the winner is the newest `updatedAt`
 *   (unparseable = oldest); an exact tie goes to the larger id, so every
 *   device picks the same winner.
 * - Every loser is tombstoned UNDER ITS OWN ID with
 *   `deletedAt = updatedAt = stampAfter(max live updatedAt)`. The winner is
 *   never rewritten or re-keyed.
 *
 * Why tombstone rather than merge into the local id: the tombstone stamp is a
 * pure function of the rows, so two devices resolving the same pair write the
 * same bytes; the tombstone is newer than any copy of the loser elsewhere, so
 * plain per-id LWW spreads it; and a re-restore finds the winner by id
 * (identical → skipped) and the loser's local tombstone newer than the
 * backup's live copy (skipped), so the second restore writes nothing.
 */
import type { DataRow, DataTableName } from './tables';
import { timeOf } from './tables';
import type { RepoContext } from './context';

export const KEYED_TABLES: ReadonlySet<DataTableName> = new Set<DataTableName>(['exerciseNotes', 'arsenal']);

const keyOf = (r: DataRow): string => JSON.stringify([String(r.profileId), String(r.exerciseId)]);
const rank = (r: DataRow): number => {
  const t = timeOf(r.updatedAt);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};

/** True when `a` beats `b` for one natural key. */
function beats(a: DataRow, b: DataRow): boolean {
  const ta = rank(a);
  const tb = rank(b);
  return ta !== tb ? ta > tb : a.id > b.id;
}

/** ISO stamp 1 ms after the newest parseable stamp; `fallback` when none parses. */
export function stampAfter(rows: readonly DataRow[], fallback: string): string {
  const max = Math.max(...rows.map(rank));
  return Number.isFinite(max) ? new Date(max + 1).toISOString() : fallback;
}

/** Local rows sharing a natural key with any of `rows`. */
async function localRowsFor(ctx: RepoContext, name: DataTableName, rows: readonly DataRow[]): Promise<DataRow[]> {
  const keys = new Map<string, [string, string]>();
  for (const r of rows) keys.set(keyOf(r), [String(r.profileId), String(r.exerciseId)]);
  if (keys.size === 0) return [];
  return ctx.db.table<DataRow, string>(name).where('[profileId+exerciseId]').anyOf([...keys.values()]).toArray();
}

/**
 * Given the rows about to be written, returns the tombstones that must be
 * written with them so each touched natural key ends with at most one live
 * row. `pending` rows override local rows of the same id. Reads only.
 */
export async function resolveKeyed(ctx: RepoContext, name: DataTableName, pending: readonly DataRow[]): Promise<DataRow[]> {
  if (!KEYED_TABLES.has(name)) return [];
  const finalById = new Map<string, DataRow>();
  for (const r of await localRowsFor(ctx, name, pending)) finalById.set(r.id, r);
  for (const r of pending) finalById.set(r.id, r);
  const groups = new Map<string, DataRow[]>();
  for (const r of finalById.values()) {
    if (r.deletedAt) continue;
    const k = keyOf(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const tombstones: DataRow[] = [];
  for (const live of groups.values()) {
    if (live.length < 2) continue;
    const winner = live.reduce((best, r) => (beats(r, best) ? r : best));
    const stamp = stampAfter(live, ctx.stamp());
    for (const r of live) if (r !== winner) tombstones.push({ ...r, deletedAt: stamp, updatedAt: stamp });
  }
  return tombstones;
}
