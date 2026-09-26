/**
 * Dexie v2 -> v3 transforms for the small per-profile tables (pure).
 * Each takes the row and its resolved v3 owner (`profileId`); a v3 row is
 * returned unchanged. v2 rows lacking a timestamp borrow the nearest one.
 * v2 wrote some stamps with `isoDate()` ('YYYY-MM-DD'); every stamp is coerced
 * to an ISO UTC datetime (midnight for a bare day, `now` when unreadable).
 */
import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  EquipmentRequirement,
  ExerciseNote,
  PRRecord,
} from '@/contracts';
import { EPOCH_ISO, coerceTimestamp, compact, finiteOr } from './coerce';
import { stableUuid } from './stable-id';
import type {
  LegacyArsenalV2,
  LegacyBodyweightEntryV2,
  LegacyEquipmentProfileV2,
  LegacyExerciseNoteV2,
  LegacyPRRecordV2,
} from './types';

/**
 * v2 PRs stored only `value` (+ optional `reps`). `kg` is recovered where the
 * type allows it: weight -> value, volume -> value / reps; else 0.
 */
export function migratePRRecordV2(pr: LegacyPRRecordV2 | PRRecord, owner: string, now: string = EPOCH_ISO): PRRecord {
  if ('createdAt' in pr && 'kg' in pr) return pr;
  const achievedAt = coerceTimestamp(pr.achievedAt, now);
  const value = finiteOr(pr.value, 0);
  const reps = finiteOr(pr.reps, pr.prType === 'reps' ? value : 0);
  let kg = 0;
  if (pr.prType === 'weight') kg = value;
  else if (pr.prType === 'volume' && reps > 0) kg = value / reps;
  return {
    id: pr.id,
    profileId: owner,
    exerciseId: pr.exerciseId,
    exerciseName: pr.exerciseName,
    prType: pr.prType,
    value,
    kg,
    reps,
    achievedAt,
    workoutLogId: pr.workoutLogId,
    createdAt: achievedAt,
    updatedAt: achievedAt,
  };
}

export function migrateBodyweightV2(
  e: LegacyBodyweightEntryV2 | BodyweightEntry,
  owner: string,
  now: string = EPOCH_ISO,
): BodyweightEntry {
  if ('updatedAt' in e) return e;
  const createdAt = coerceTimestamp(e.createdAt, now);
  return { id: e.id, profileId: owner, date: e.date, valueKg: e.valueKg, createdAt, updatedAt: createdAt };
}

export function migrateNoteV2(n: LegacyExerciseNoteV2 | ExerciseNote, owner: string, now: string = EPOCH_ISO): ExerciseNote {
  if ('createdAt' in n) return n;
  const updatedAt = coerceTimestamp(n.updatedAt, now);
  return compact<ExerciseNote>({ ...n, profileId: owner, createdAt: updatedAt, updatedAt });
}

/**
 * v2 arsenal rows were whole exercises keyed by the catalog exercise id (a
 * slug). v3 user-data ids are uuids, so the slug moves to `exerciseId` and the
 * row gets a uuid derived from owner + exercise (same on every re-run).
 */
export function migrateArsenalV2(a: LegacyArsenalV2 | ArsenalEntry, owner: string, now: string = EPOCH_ISO): ArsenalEntry {
  if ('exerciseId' in a) return a;
  const addedAt = coerceTimestamp(a.addedAt, now);
  return { id: stableUuid('arsenal', owner, a.id), profileId: owner, exerciseId: a.id, addedAt, updatedAt: addedAt };
}

/** Migrated arsenal rows, one per [profileId+exerciseId]; an existing v3 row wins. */
export function dedupeArsenal(rows: readonly ArsenalEntry[]): ArsenalEntry[] {
  const fresh = (r: ArsenalEntry): boolean => r.id === stableUuid('arsenal', r.profileId, r.exerciseId);
  const out = new Map<string, ArsenalEntry>();
  for (const r of rows) {
    const key = JSON.stringify([r.profileId, r.exerciseId]);
    const kept = out.get(key);
    if (kept === undefined || (fresh(kept) && !fresh(r))) out.set(key, r);
  }
  return [...out.values()];
}

/**
 * v3 rule (LogsRepo.softDelete): a soft-deleted log's PRs are tombstoned with
 * the log's own `deletedAt`, so LogsRepo.restore can revive exactly them.
 */
export function tombstoneWithLog(pr: PRRecord, logDeletedAt: string | undefined): PRRecord {
  if (logDeletedAt === undefined || pr.deletedAt !== undefined) return pr;
  const updatedAt = pr.updatedAt > logDeletedAt ? pr.updatedAt : logDeletedAt;
  return { ...pr, deletedAt: logDeletedAt, updatedAt };
}

/** v2 station flags -> `tytax_library.json` STATIONS keys. */
const STATION_FLAGS: ReadonlyArray<[keyof LegacyEquipmentProfileV2, string]> = [
  ['hasSmithMachine', 'SMITH'],
  ['hasUpperPulley', 'BACK_UPPER'],
  ['hasLowerPulley', 'BACK_LOWER'],
  ['hasLegExtension', 'LEG_EXTENSION'],
  ['hasLegCurl', 'LEG_CURL'],
];

const GEAR_FLAGS: ReadonlyArray<[keyof LegacyEquipmentProfileV2, EquipmentRequirement]> = [
  ['hasPullUpBar', 'pull-up-bar'],
  ['hasDipStation', 'dip-station'],
  ['hasRings', 'rings'],
  ['hasParallettes', 'parallettes'],
];

function numbers(values: unknown): number[] {
  return Array.isArray(values) ? values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) : [];
}

/** v2 equipment profile -> the owner's single v3 inventory row (`id === profileId`). */
export function migrateEquipmentV2(eq: LegacyEquipmentProfileV2, owner: string, now: string): EquipmentInventory {
  const kettlebellsKg = numbers(eq.kettlebellWeights);
  const gear = GEAR_FLAGS.filter(([flag]) => eq[flag] === true).map(([, g]) => g);
  if (kettlebellsKg.length > 0) gear.push('kettlebell');
  return {
    id: owner,
    profileId: owner,
    stationIds: STATION_FLAGS.filter(([flag]) => eq[flag] === true).map(([, s]) => s),
    attachmentIds: Array.isArray(eq.attachments) ? eq.attachments.filter((a) => typeof a === 'string') : [],
    kettlebellsKg,
    bodyweightGear: gear,
    createdAt: now,
    updatedAt: now,
  };
}
