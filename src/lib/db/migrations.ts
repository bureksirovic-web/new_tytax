/**
 * Dexie v2 → v3 in-place migration.
 *
 * Wave 0 baseline migration; G2 owns hardening + tests (AC18).
 *
 * Input shapes are the `Legacy*V2` types from src/contracts/domain.ts. Rows
 * are read as unknown records and only fields that exist are carried over.
 */
import type { Transaction } from 'dexie';
import type {
  LegacyExerciseLogV2,
  LegacyUserProfileV2,
  Profile,
  ProfileSettings,
  SessionExercise,
  SetEntry,
  WorkoutLog,
} from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import { newUuid } from './ids';

type Row = Record<string, unknown>;

function isRow(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** LegacyUserProfileV2 → Profile. Rows that already carry `settings` pass through. */
export function migrateProfileRow(row: Row, nowIso: string): Row {
  if (isRow(row.settings)) return row;
  const legacy = row as Partial<LegacyUserProfileV2> & Row;
  const settings: ProfileSettings = {
    ...DEFAULT_PROFILE_SETTINGS,
    plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg],
  };
  if (legacy.unitSystem === 'imperial') settings.units = 'lb';
  else if (legacy.unitSystem === 'metric') settings.units = 'kg';
  if (legacy.language === 'en' || legacy.language === 'hr') settings.language = legacy.language;
  if (legacy.theme === 'tactical' || legacy.theme === 'oled') settings.theme = legacy.theme;
  if (legacy.warmupStrategy === 'standard' || legacy.warmupStrategy === 'heavy' || legacy.warmupStrategy === 'pyramid') {
    settings.warmupStrategy = legacy.warmupStrategy;
  }
  const bar = num(legacy.barWeightKg);
  if (bar !== undefined && bar >= 0) settings.barWeightKg = bar;

  const createdAt = str(legacy.createdAt) ?? nowIso;
  const profile: Profile = {
    id: String(legacy.id),
    name: str(legacy.displayName)?.trim() || 'Profile',
    activeProgramId: null,
    settings,
    createdAt,
    updatedAt: str(legacy.updatedAt) ?? createdAt,
  };
  const bw = num(legacy.bodyweightKg);
  if (bw !== undefined) profile.bodyweightKg = bw;
  if (legacy.gender) profile.gender = legacy.gender;
  if (legacy.experienceLevel) profile.experienceLevel = legacy.experienceLevel;
  return { ...profile };
}

function migrateSet(raw: unknown): SetEntry | undefined {
  if (!isRow(raw)) return undefined;
  const s = raw as Partial<LegacyExerciseLogV2['sets'][number]> & Partial<SetEntry> & Row;
  const done = s.done === true;
  const set: SetEntry = {
    id: str(s.id) ?? newUuid(),
    type: s.type ?? 'working',
    kg: num(s.kg) ?? 0,
    reps: num(s.reps) ?? 0,
    done,
  };
  const rir = num(s.rir);
  if (rir !== undefined) set.rir = rir;
  if (typeof s.tempo === 'string') set.tempo = s.tempo;
  const completedAt = str(s.completedAt) ?? (done ? str(s.timestamp) : undefined);
  if (completedAt) set.completedAt = completedAt;
  if (s.isPersonalRecord === true || s.isPR === true) set.isPR = true;
  const e1rm = num(s.e1rm);
  if (e1rm !== undefined) set.e1rm = e1rm;
  return set;
}

function migrateExercise(raw: unknown): SessionExercise | undefined {
  if (!isRow(raw)) return undefined;
  const ex = raw as Partial<LegacyExerciseLogV2> & Partial<SessionExercise> & Row;
  const exerciseId = str(ex.exerciseId) ?? str(ex.exerciseRef);
  if (!exerciseId) return undefined;
  const modality = ex.modality;
  const out: SessionExercise = {
    uid: str(ex.uid) ?? newUuid(),
    exerciseId,
    exerciseName: str(ex.exerciseName) ?? exerciseId,
    modality: modality === 'tytax' || modality === 'bodyweight' || modality === 'kettlebell' ? modality : 'custom',
    sets: (Array.isArray(ex.sets) ? ex.sets : []).map(migrateSet).filter((s): s is SetEntry => s !== undefined),
  };
  const rest = num(ex.restSeconds);
  if (rest !== undefined) out.restSeconds = rest;
  if (typeof ex.notes === 'string') out.notes = ex.notes;
  if (typeof ex.supersetGroup === 'string') out.supersetGroup = ex.supersetGroup;
  if (Array.isArray(ex.muscleImpactSnapshot)) out.muscleImpactSnapshot = ex.muscleImpactSnapshot;
  return out;
}

/** LegacyWorkoutLogV2 → WorkoutLog (exerciseRef → exerciseId, uid, set cleanup). */
export function migrateWorkoutLogRow(row: Row): Row {
  const next: Row = { ...row };
  delete next.familyMemberId;
  const exercises = Array.isArray(row.exercises) ? row.exercises : [];
  next.exercises = exercises.map(migrateExercise).filter((e): e is SessionExercise => e !== undefined);
  const startedAt = str(row.startedAt) ?? str(row.createdAt) ?? new Date(0).toISOString();
  next.startedAt = startedAt;
  next.finishedAt = str(row.finishedAt) ?? startedAt;
  next.updatedAt = str(row.updatedAt) ?? str(row.createdAt) ?? startedAt;
  next.prCount = num(row.prCount) ?? 0;
  next.totalSets = num(row.totalSets) ?? 0;
  next.totalVolumeKg = num(row.totalVolumeKg) ?? 0;
  next.durationSeconds = num(row.durationSeconds) ?? 0;
  if (!Array.isArray(row.modalitiesUsed)) {
    next.modalitiesUsed = [...new Set((next.exercises as WorkoutLog['exercises']).map((e) => e.modality))];
  }
  return next;
}

/** Old arsenal rows were whole exercises keyed by the exercise id. */
export function migrateArsenalRow(row: Row, nowIso: string): Row {
  const addedAt = str(row.addedAt) ?? nowIso;
  return {
    id: String(row.id),
    profileId: str(row.profileId) ?? '',
    exerciseId: str(row.exerciseId) ?? String(row.id),
    addedAt,
    updatedAt: str(row.updatedAt) ?? addedAt,
    ...(str(row.deletedAt) ? { deletedAt: str(row.deletedAt) } : {}),
  };
}

/** Wave 0 baseline migration; G2 owns hardening + tests (AC18). */
export async function migrateToV3(tx: Transaction): Promise<void> {
  const nowIso = new Date().toISOString();

  // Profiles first (in memory), so programs can set activeProgramId on them.
  const profileRows = (await tx.table('profiles').toArray()).filter(isRow);
  const profiles = profileRows.map((r) => migrateProfileRow(r, nowIso));

  // programs: boolean isActive → owning profile's activeProgramId.
  const programTable = tx.table('programs');
  const programRows = (await programTable.toArray()).filter(isRow);
  for (const program of programRows) {
    const next: Row = { ...program };
    if (program.isActive === true && !program.deletedAt) {
      const owner = profiles.find((p) => p.id === program.profileId) ?? profiles[0];
      if (owner && owner.activeProgramId == null) {
        owner.activeProgramId = program.id;
        // An orphaned active program is adopted by the fallback owner, so the
        // profile's activeProgramId always names a program it owns.
        next.profileId = owner.id;
      }
    }
    delete next.isActive;
    if (num(next.currentSessionIndex) === undefined) next.currentSessionIndex = 0;
    await programTable.put(next);
  }
  await tx.table('profiles').bulkPut(profiles);

  await tx.table('workoutLogs').toCollection().modify((row: Row, ref: { value: Row }) => {
    ref.value = migrateWorkoutLogRow(row);
  });

  await tx.table('prRecords').toCollection().modify((row: Row) => {
    const achievedAt = str(row.achievedAt) ?? nowIso;
    if (num(row.kg) === undefined) row.kg = row.prType === 'weight' ? num(row.value) ?? 0 : 0;
    if (num(row.reps) === undefined) row.reps = 0;
    if (!str(row.createdAt)) row.createdAt = achievedAt;
    if (!str(row.updatedAt)) row.updatedAt = achievedAt;
  });

  await tx.table('bodyweightEntries').toCollection().modify((row: Row) => {
    if (!str(row.createdAt)) row.createdAt = nowIso;
    if (!str(row.updatedAt)) row.updatedAt = str(row.createdAt) ?? nowIso;
  });

  await tx.table('exerciseNotes').toCollection().modify((row: Row) => {
    if (!str(row.updatedAt)) row.updatedAt = nowIso;
    if (!str(row.createdAt)) row.createdAt = str(row.updatedAt) ?? nowIso;
  });

  await tx.table('arsenal').toCollection().modify((row: Row, ref: { value: Row }) => {
    ref.value = migrateArsenalRow(row, nowIso);
  });

  // The old outbox shape (tableName/operationType/payload) is not drainable by v3.
  await tx.table('syncQueue').clear();
}
