/** Pure helpers over stored rows: soft-delete filtering, sorting, paging, patch hygiene, set rules. */
import type { Table } from 'dexie';
import type { PRRecord, PRType, SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import type { ListOptions } from '@/contracts/repo';
import type { ExistingBests, PRCandidate } from '@/contracts/training';
import { training } from '@/lib/training';

// ─── Records and lists ───────────────────────────────────────────────────────

export interface SoftDeletable {
  deletedAt?: string;
}

export function isLive(row: SoftDeletable): boolean {
  return !row.deletedAt;
}

export function visible<T extends SoftDeletable>(rows: T[], includeDeleted?: boolean): T[] {
  return includeDeleted ? rows : rows.filter(isLive);
}

export function paginate<T>(rows: T[], opts?: ListOptions): T[] {
  const offset = Math.max(0, Math.floor(opts?.offset ?? 0));
  const limit = opts?.limit;
  if (limit === undefined) return offset ? rows.slice(offset) : rows;
  return rows.slice(offset, offset + Math.max(0, Math.floor(limit)));
}

/** Descending string compare (ISO timestamps and 'YYYY-MM-DD' sort lexically). */
export function desc(a: string | undefined, b: string | undefined): number {
  const x = a ?? '';
  const y = b ?? '';
  return x < y ? 1 : x > y ? -1 : 0;
}

export function asc(a: string | undefined, b: string | undefined): number {
  return -desc(a, b);
}

/** Drops keys whose value is `undefined` (top level only). */
export function compact<T extends object>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out) as Array<keyof T>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Copy without `deletedAt`. */
export function undeleted<T extends SoftDeletable>(row: T): T {
  const out = { ...row };
  delete out.deletedAt;
  return out;
}

/** Rows of one profile in a table indexed by `profileId`. */
export function byProfile<T>(table: Table<T, string>, profileId: string): Promise<T[]> {
  return table.where('profileId').equals(profileId).toArray();
}

/** Removes keys the caller may never patch. */
export function stripKeys<T extends object>(patch: T, keys: readonly string[]): T {
  const out = { ...patch };
  for (const key of keys) delete (out as Record<string, unknown>)[key];
  return out;
}

// ─── Set and history rules ───────────────────────────────────────────────────

/** TODO(G1): import E1RM_MAX_REPS from @/lib/training once G1 merges (same value, 12). */
export const E1RM_MAX_REPS = 12;

/** A set that counts as training: done and not a warm-up (contract rule). */
export function countsAsWork(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup';
}

/** Time set: the repo only sees the set, so any set carrying `durationSeconds` is time-measured. */
export function isTimeSet(s: SetEntry): boolean {
  return s.durationSeconds !== undefined && s.durationSeconds !== null;
}

/** Best (max value) live record per PR type; ties keep the earliest achieved. */
export function bestPerType(records: readonly PRRecord[]): Partial<Record<PRType, PRRecord>> {
  const best: Partial<Record<PRType, PRRecord>> = {};
  for (const r of records) {
    if (r.deletedAt) continue;
    const cur = best[r.prType];
    if (!cur || r.value > cur.value || (r.value === cur.value && asc(r.achievedAt, cur.achievedAt) < 0)) best[r.prType] = r;
  }
  return best;
}

/** Position of a log in its profile's history. */
export type LogPlace = Pick<WorkoutLog, 'id' | 'date' | 'startedAt'>;

/** Chronological order of a profile's history: date, then startedAt, then id. */
export function chrono(a: LogPlace, b: LogPlace): number {
  return asc(a.date, b.date) || asc(a.startedAt, b.startedAt) || asc(a.id, b.id);
}

/**
 * Stamp for a rewrite of a row last stamped `prev`: `stamp`, or `prev` + 1 ms
 * when `prev` is not older (a row pulled from a fast clock). Sync is
 * last-writer-wins on updatedAt, so a rewrite must never move it backwards.
 */
export function laterStamp(stamp: string, prev: string | undefined): string {
  const p = prev === undefined ? NaN : Date.parse(prev);
  return Number.isFinite(p) && p >= Date.parse(stamp) ? new Date(p + 1).toISOString() : stamp;
}

/**
 * Writes `rows` (upserts). When they cover at least half of the table, the
 * table is cleared and refilled: an overwrite re-indexes the row, which costs
 * a scan of each index per row under fake-indexeddb (measured 6.4 s for 2000
 * of 2000 rows; clear + bulkAdd of the same rows well under 0.5 s), while a
 * real IndexedDB does at most twice the writes. Run inside a rw transaction.
 */
export async function upsertRows<T extends { id: string }>(table: Table<T, string>, rows: readonly T[]): Promise<void> {
  if (rows.length === 0) return;
  const total = await table.count();
  if (rows.length * 2 < total) {
    await table.bulkPut([...rows]);
    return;
  }
  const byId = new Map((await table.toArray()).map((r) => [r.id, r]));
  for (const r of rows) byId.set(r.id, r);
  await table.clear();
  await table.bulkAdd([...byId.values()]);
}

// ─── PR detection and annotation (pure) ──────────────────────────────────────

/** e1RM stored on a set: counting reps sets with reps <= E1RM_MAX_REPS only (F3). */
export function storedE1rm(s: SetEntry): number | undefined {
  if (!countsAsWork(s) || isTimeSet(s) || s.reps > E1RM_MAX_REPS) return undefined;
  return training.e1rm(s.kg, s.reps);
}

const keepSets = (exercises: readonly SessionExercise[], keep: (s: SetEntry) => boolean): SessionExercise[] =>
  exercises.map((ex) => ({ ...ex, sets: ex.sets.filter(keep) }));

/**
 * training.detectPRs behind the repo rules: time sets never rank; the e1rm
 * type ranks only sets with reps <= E1RM_MAX_REPS (detectPRs itself ranks any
 * rep count, so e1rm runs over a filtered view); weight ranks every reps set.
 */
export function detectRepoPRs(exercises: readonly SessionExercise[], bests: ExistingBests): PRCandidate[] {
  const reps = keepSets(exercises, (s) => !isTimeSet(s));
  const capped = new Map<string, PRCandidate>();
  for (const c of training.detectPRs(keepSets(reps, (s) => s.reps <= E1RM_MAX_REPS), bests)) if (c.prType === 'e1rm') capped.set(c.exerciseId, c);
  // A capped e1rm PR implies an uncapped one (subset max <= full max): mapping keeps order, misses nothing.
  const out: PRCandidate[] = [];
  for (const c of training.detectPRs(reps, bests)) {
    const pick = c.prType === 'e1rm' ? capped.get(c.exerciseId) : c;
    if (pick) out.push(pick);
  }
  return out;
}

export type Bests = Record<string, Partial<Record<PRType, number>>>;
export const absorb = (bests: Bests, cands: readonly PRCandidate[]): void => {
  for (const c of cands) (bests[c.exerciseId] ??= {})[c.prType] = c.value;
};

/** Best value per (exercise, PR type) over `logs`, measured exactly as detectRepoPRs measures a workout. */
export function bestsFromLogs(logs: readonly WorkoutLog[]): ExistingBests {
  const bests: Bests = Object.create(null);
  for (const log of logs) if (!log.deletedAt && Array.isArray(log.exercises)) absorb(bests, detectRepoPRs(log.exercises, bests));
  return bests;
}

export const setKey = (uid: string, setId: string): string => `${uid}::${setId}`;

/** Stored exercises: e1RM per `storedE1rm`, isPR on sets that set a non-baseline PR. */
export function annotate(exercises: readonly SessionExercise[], celebrated: readonly PRCandidate[]): SessionExercise[] {
  const prSets = new Set(celebrated.map((c) => setKey(c.sessionExerciseUid, c.setId)));
  return exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => {
      const set = { ...s };
      delete set.isPR;
      delete set.e1rm;
      const e = storedE1rm(s);
      if (e !== undefined) set.e1rm = e;
      if (countsAsWork(s) && prSets.has(setKey(ex.uid, s.id))) set.isPR = true;
      return set;
    }),
  }));
}

export const sameAnnotations = (a: readonly SessionExercise[], b: readonly SessionExercise[]): boolean =>
  a.every((ex, i) => ex.sets.every((s, j) => s.isPR === b[i].sets[j].isPR && s.e1rm === b[i].sets[j].e1rm));
