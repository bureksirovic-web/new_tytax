import { describe, expect, it } from 'vitest';
import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  ExerciseNote,
  PRRecord,
  Profile,
  Program,
} from '@/contracts/domain';
import { buildProfile, buildWorkoutLog } from '@/contracts/fixtures';
import { SYNC_TABLES, type SyncTable } from '@/contracts/sync';
import { PUSH_ORDER, TABLE_SPECS, remoteTableOf } from '../columns';
import { SyncMapError, fromRemote, isUuid, toRemote } from '../mapper';
import { ACCOUNT_A, uuid } from './harness';

const NOW = new Date(Date.UTC(2026, 8, 26, 10));
const STAMP = NOW.toISOString();
const wire = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function fixtures(): Record<SyncTable, Array<Record<string, unknown>>> {
  const memberId = uuid();
  const programId = uuid();
  const logId = uuid();
  const profile: Profile = {
    ...buildProfile({ name: 'Ana', settings: { units: 'lb' } }, NOW, uuid),
    accountId: ACCOUNT_A,
    avatarColor: '#4a7c3f',
    activeProgramId: programId,
    bodyweightKg: 61.5,
    gender: 'female',
    experienceLevel: 'intermediate',
  };
  const bare: Profile = { ...buildProfile({}, NOW, uuid), accountId: ACCOUNT_A, deletedAt: STAMP };
  const log = buildWorkoutLog(memberId, { daysAgo: 1, rpe: 8, notes: 'good', exercises: [{ exerciseId: 'bench', sets: [{ kg: 60, reps: 8, rir: 2 }, { kg: 20, reps: 10, type: 'warmup', done: false }] }] }, NOW, uuid);
  const program: Program = {
    id: programId,
    profileId: memberId,
    name: 'PPL',
    splitType: 'push_pull_legs',
    frequency: 6,
    periodizationType: 'linear',
    periodizationConfig: { type: 'linear', linearIncrement: 2.5, linearFrequencyWeeks: 1 },
    sessionOrder: ['Push', 'Pull'],
    sessions: [{ id: uuid(), programId, name: 'Push', dayIndex: 0, exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: 3, reps: '8-12' }] }],
    modalitiesUsed: ['tytax'],
    isPreset: true,
    presetId: 'tytax-6day',
    currentSessionIndex: 1,
    rotationStartDate: '2026-09-01',
    createdAt: STAMP,
    updatedAt: STAMP,
  };
  const pr: PRRecord = { id: uuid(), profileId: memberId, exerciseId: 'bench', exerciseName: 'Bench', prType: 'e1rm', value: 75.5, kg: 60, reps: 8, achievedAt: STAMP, workoutLogId: logId, setId: 'set-1', createdAt: STAMP, updatedAt: STAMP };
  const bw: BodyweightEntry = { id: uuid(), profileId: memberId, date: '2026-09-26', valueKg: 82.3, createdAt: STAMP, updatedAt: STAMP, deletedAt: STAMP };
  const note: ExerciseNote = { id: uuid(), profileId: memberId, exerciseId: 'bench', content: 'elbows in', createdAt: STAMP, updatedAt: STAMP };
  const arsenal: ArsenalEntry = { id: uuid(), profileId: memberId, exerciseId: 'bench', addedAt: STAMP, updatedAt: STAMP };
  const equipment: EquipmentInventory = { id: memberId, profileId: memberId, stationIds: ['SMITH'], attachmentIds: ['rope'], kettlebellsKg: [16, 24], bodyweightGear: ['rings'], createdAt: STAMP, updatedAt: STAMP };
  const R = (xs: object[]): Array<Record<string, unknown>> => xs as unknown as Array<Record<string, unknown>>;
  return {
    profiles: R([profile, bare]),
    workout_logs: R([log, { ...log, id: logId, programId, programSessionId: 'push', isDeload: true, bodyweightKg: 80 }]),
    programs: R([program, { ...program, id: uuid(), periodizationConfig: undefined, presetId: undefined, rotationStartDate: undefined }]),
    pr_records: R([pr]),
    bodyweight_entries: R([bw]),
    exercise_notes: R([note]),
    arsenal: R([arsenal]),
    equipment: R([equipment]),
  };
}

function strip(rec: Record<string, unknown>): Record<string, unknown> {
  const out = { ...rec };
  delete out.syncedAt;
  return out;
}

describe('mapper round trip', () => {
  const all = fixtures();

  it.each(PUSH_ORDER.map((t) => [t]))('fromRemote(toRemote(x)) deep-equals x for %s', (table) => {
    expect(all[table].length).toBeGreaterThan(0);
    for (const rec of all[table]) {
      const withLocal = { ...rec, syncedAt: STAMP };
      const row = wire(toRemote(table, withLocal, ACCOUNT_A));
      expect(row.synced_at).toBeUndefined();
      expect(row.extra).toEqual({});
      expect(fromRemote(table, row)).toEqual(strip(withLocal));
    }
  });

  it('covers every SyncTable with a remote table map', () => {
    expect([...PUSH_ORDER].sort()).toEqual([...SYNC_TABLES].sort());
    expect(remoteTableOf('profiles')).toBe('family_members');
    expect(Object.keys(TABLE_SPECS)).toHaveLength(8);
  });

  it('maps owner columns: account for profiles, family member for records', () => {
    const profile = all.profiles[0];
    const row = toRemote('profiles', profile, ACCOUNT_A);
    expect(row.profile_id).toBe(ACCOUNT_A);
    expect(row.family_member_id).toBeUndefined();
    expect(row.active_program_id).toBe(profile.activeProgramId);
    const log = all.workout_logs[0];
    const logRow = toRemote('workout_logs', log, ACCOUNT_A);
    expect(logRow).toMatchObject({ profile_id: ACCOUNT_A, family_member_id: log.profileId, session_name: log.sessionName, total_volume_kg: log.totalVolumeKg });
    expect(logRow.profileId).toBeUndefined();
  });

  it('sends undefined optionals as null and pulls null back as an absent key (activeProgramId stays null)', () => {
    const bare = all.profiles[1];
    const row = toRemote('profiles', bare, ACCOUNT_A);
    expect(row.avatar_color).toBeNull();
    expect(row.active_program_id).toBeNull();
    const back = fromRemote('profiles', wire(row));
    expect('avatarColor' in back).toBe(false);
    expect(back.activeProgramId).toBeNull();
    expect(fromRemote('profiles', { ...wire(row), active_program_id: undefined }).activeProgramId).toBeNull();
  });

  it('carries unknown camelCase fields through extra and back', () => {
    const note = { ...all.exercise_notes[0], pinned: true, tags: ['form'], later: undefined };
    const row = toRemote('exercise_notes', note, ACCOUNT_A);
    expect(row.extra).toEqual({ pinned: true, tags: ['form'] });
    const back = fromRemote('exercise_notes', wire(row));
    expect(back.pinned).toBe(true);
    expect(back.tags).toEqual(['form']);
  });

  it('never lets extra override a mapped column or leak unknown snake columns', () => {
    const row = { ...toRemote('programs', all.programs[0], ACCOUNT_A), is_active: true, extra: { name: 'evil', syncedAt: 'x', fresh: 1 } };
    const back = fromRemote('programs', wire(row));
    expect(back.name).toBe('PPL');
    expect(back.syncedAt).toBeUndefined();
    expect(back.isActive).toBeUndefined();
    expect(back.is_active).toBeUndefined();
    expect(back.fresh).toBe(1);
  });

  it('normalises server timestamps to ISO Z with milliseconds', () => {
    const row = wire(toRemote('bodyweight_entries', all.bodyweight_entries[0], ACCOUNT_A));
    row.updated_at = '2026-09-26T10:00:00.123456+00:00';
    row.deleted_at = null;
    const back = fromRemote('bodyweight_entries', row);
    expect(back.updatedAt).toBe('2026-09-26T10:00:00.123Z');
    expect(back.date).toBe('2026-09-26');
    expect('deletedAt' in back).toBe(false);
  });

  it('fills missing profile settings from the defaults (legacy rows)', () => {
    const row = { ...wire(toRemote('profiles', all.profiles[1], ACCOUNT_A)), settings: {} };
    const back = fromRemote('profiles', row);
    expect(back.settings).toMatchObject({ units: 'kg', language: 'hr', barWeightKg: 20 });
    expect(back.accountId).toBe(ACCOUNT_A);
  });
});

describe('mapper id validation', () => {
  const all = fixtures();
  const invalid = (fn: () => unknown, field: string) => {
    let caught: unknown;
    try {
      fn();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SyncMapError);
    expect((caught as SyncMapError).code).toBe('invalid_id');
    expect((caught as SyncMapError).field).toBe(field);
  };

  it('accepts uuid v1-v8 and rejects everything else', () => {
    expect(isUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    expect(isUuid('01890a5d-ac96-7c4e-8f1b-9f0a2b3c4d5e')).toBe(true);
    expect(isUuid('local')).toBe(false);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it('rejects non-uuid record, owner, account and FK ids on push', () => {
    invalid(() => toRemote('profiles', { ...all.profiles[0], id: 'local' }, ACCOUNT_A), 'id');
    invalid(() => toRemote('workout_logs', { ...all.workout_logs[0], profileId: 'local' }, ACCOUNT_A), 'profileId');
    invalid(() => toRemote('workout_logs', all.workout_logs[0], 'local'), 'accountId');
    invalid(() => toRemote('workout_logs', { ...all.workout_logs[0], programId: 'preset-slug' }, ACCOUNT_A), 'programId');
    invalid(() => toRemote('pr_records', { ...all.pr_records[0], workoutLogId: 'id-1' }, ACCOUNT_A), 'workoutLogId');
    invalid(() => toRemote('profiles', { ...all.profiles[0], activeProgramId: 'nope' }, ACCOUNT_A), 'activeProgramId');
  });

  it('rejects bad ids on pull and a profile owned by another account on push', () => {
    const row = wire(toRemote('arsenal', all.arsenal[0], ACCOUNT_A));
    invalid(() => fromRemote('arsenal', { ...row, family_member_id: null }), 'family_member_id');
    invalid(() => fromRemote('arsenal', { ...row, id: 'x' }), 'id');
    invalid(() => fromRemote('profiles', { ...wire(toRemote('profiles', all.profiles[1], ACCOUNT_A)), profile_id: 'x' }), 'profile_id');
    expect(() => toRemote('profiles', { ...all.profiles[0], accountId: uuid() }, ACCOUNT_A)).toThrow(/account_mismatch/);
  });
});
