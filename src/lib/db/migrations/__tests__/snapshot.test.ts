import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type Profile } from '@/contracts';
import { buildPreMigrationExport, migrateSnapshotV2toV3 } from '../snapshot';
import type { SnapshotV2, TablesV3 } from '../types';
import { CTX, v2FamilyLog, v2Log, v2Program, v2Snapshot } from './fixture';

const counts = (t: TablesV3) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, (v as unknown[]).length]));

describe('migrateSnapshotV2toV3', () => {
  const { tables, activeProfileId } = migrateSnapshotV2toV3(v2Snapshot(), CTX);

  it('turns the user and the family member into profiles', () => {
    const userSettings = { ...DEFAULT_PROFILE_SETTINGS, units: 'lb', language: 'en', theme: 'oled', warmupStrategy: 'heavy', barWeightKg: 15, plateSetKg: [20, 10, 5] };
    const expected: Profile[] = [
      { id: 'u-1', name: 'Test Lifter', activeProgramId: 'p-2', settings: userSettings as Profile['settings'], bodyweightKg: 80, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' },
      { id: 'fm-1', name: 'Kid', activeProgramId: null, settings: userSettings as Profile['settings'], gender: 'female', createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z' },
    ];
    expect(tables.profiles).toStrictEqual(expected);
    expect(activeProfileId).toBe('fm-1');
  });

  it("maps 'local' rows to the user and familyMemberId rows to the member", () => {
    expect(tables.workoutLogs.map((l) => [l.id, l.profileId])).toEqual([['log-1', 'u-1'], ['log-2', 'fm-1']]);
    expect(tables.programs.map((p) => [p.id, p.profileId, p.currentSessionIndex])).toEqual([
      ['p-1', 'u-1', 0],
      ['p-2', 'u-1', 1],
      ['p-3', 'u-1', 0],
      ['p-4', 'fm-1', 0],
    ]);
    expect(tables.workoutLogs[0].totalVolumeKg).toBe(2035);
  });

  it('migrates the small tables', () => {
    expect(tables.prRecords).toStrictEqual([
      { id: 'pr-1', profileId: 'fm-1', exerciseId: 'pullup', exerciseName: 'Pull-up', prType: 'volume', value: 400, kg: 50, reps: 8, achievedAt: '2026-03-02T10:30:00.000Z', workoutLogId: 'log-2', createdAt: '2026-03-02T10:30:00.000Z', updatedAt: '2026-03-02T10:30:00.000Z' },
    ]);
    expect(tables.bodyweightEntries).toStrictEqual([{ id: 'bw-1', profileId: 'u-1', date: '2026-03-01', valueKg: 80.5, createdAt: '2026-03-01T07:00:00.000Z', updatedAt: '2026-03-01T07:00:00.000Z' }]);
    expect(tables.exerciseNotes).toStrictEqual([{ id: 'n-1', profileId: 'u-1', exerciseId: 'bench', content: 'Elbows in', updatedAt: '2026-03-01T08:00:00.000Z', createdAt: '2026-03-01T08:00:00.000Z' }]);
    expect(tables.arsenal).toStrictEqual([{ id: 'bench', profileId: 'u-1', exerciseId: 'bench', addedAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' }]);
    expect(tables.equipment).toStrictEqual([
      { id: 'u-1', profileId: 'u-1', stationIds: ['SMITH', 'BACK_UPPER', 'LEG_CURL'], attachmentIds: ['rope'], kettlebellsKg: [16, 24], bodyweightGear: ['pull-up-bar', 'rings', 'kettlebell'], createdAt: CTX.now, updatedAt: CTX.now },
    ]);
    expect(counts(tables)).toEqual({ profiles: 2, workoutLogs: 2, programs: 4, prRecords: 1, bodyweightEntries: 1, exerciseNotes: 1, arsenal: 1, equipment: 1 });
  });

  it('is idempotent: migrate(migrate(x)) deep-equals migrate(x)', () => {
    const again = migrateSnapshotV2toV3(structuredClone(tables), CTX);
    expect(again.tables).toStrictEqual(tables);
    expect(counts(again.tables)).toEqual(counts(tables));
  });

  it('survives a JSON round trip of its own output', () => {
    const json = JSON.parse(JSON.stringify(tables)) as TablesV3;
    expect(json).toStrictEqual(tables);
    expect(migrateSnapshotV2toV3(json, CTX).tables).toStrictEqual(tables);
  });
});

describe('profile id mapping edge cases', () => {
  it("synthesises one profile for 'local' data when v2 has no profile row", () => {
    const snap: SnapshotV2 = {
      workoutLogs: [v2Log()],
      programs: [v2Program('p-1', { isActive: true })],
      equipmentProfiles: v2Snapshot().equipmentProfiles?.slice(1),
    };
    const { tables, activeProfileId } = migrateSnapshotV2toV3(snap, { ...CTX, defaultProfileName: 'Ja' });
    expect(tables.profiles).toHaveLength(1);
    expect(tables.profiles[0]).toMatchObject({ id: 'synth-1', name: 'Ja', activeProgramId: 'p-1' });
    expect(tables.profiles[0].settings.plateSetKg).toEqual([20, 10, 5]);
    expect(tables.workoutLogs[0].profileId).toBe('synth-1');
    expect(activeProfileId).toBe('synth-1');
    expect(migrateSnapshotV2toV3(tables, CTX).tables).toStrictEqual(tables);
  });

  it('uses crypto.randomUUID when no id generator is given', () => {
    const { tables } = migrateSnapshotV2toV3({ workoutLogs: [v2Log()] }, { now: CTX.now });
    expect(tables.profiles[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tables.profiles[0].name).toBe('Profile');
  });

  it('an empty database stays empty', () => {
    const r = migrateSnapshotV2toV3({}, CTX);
    expect(counts(r.tables)).toEqual({ profiles: 0, workoutLogs: 0, programs: 0, prRecords: 0, bodyweightEntries: 0, exerciseNotes: 0, arsenal: 0, equipment: 0 });
    expect(r.activeProfileId).toBeNull();
  });

  it('orphans of a deleted family member go to the oldest v3 profile; a v3 owner of v2 programs gets its active id', () => {
    const base = migrateSnapshotV2toV3(v2Snapshot(), CTX).tables.profiles;
    const log = { ...v2FamilyLog(), familyMemberId: 'gone' };
    const { tables, activeProfileId } = migrateSnapshotV2toV3(
      { userProfiles: [base[1], base[0]], workoutLogs: [log], programs: [v2Program('p-9', { profileId: 'u-1', isActive: true })] },
      CTX,
    );
    expect(tables.workoutLogs[0].profileId).toBe('u-1');
    expect(tables.profiles.find((p) => p.id === 'u-1')?.activeProgramId).toBe('p-9');
    expect(activeProfileId).toBe('u-1');
  });

  it('a family member whose owner is unknown inherits the primary settings', () => {
    const snap = v2Snapshot();
    snap.familyMembers = [{ id: 'fm-2', profileId: 'nobody', name: 'Guest', createdAt: '2026-01-06' }];
    const guest = migrateSnapshotV2toV3(snap, CTX).tables.profiles.find((p) => p.id === 'fm-2');
    expect(guest?.settings.units).toBe('lb');
    const alone = migrateSnapshotV2toV3({ familyMembers: snap.familyMembers }, CTX).tables.profiles;
    expect(alone[0].settings).toStrictEqual({ ...DEFAULT_PROFILE_SETTINGS });
  });
});

describe('buildPreMigrationExport', () => {
  it('holds every v2 table verbatim and is JSON round-trippable', () => {
    const snap = v2Snapshot();
    const exp = buildPreMigrationExport(snap, CTX.now);
    expect(exp.format).toBe('tytax-v2-premigration');
    expect(exp.version).toBe(2);
    expect(exp.exportedAt).toBe(CTX.now);
    expect(Object.keys(exp.tables).sort()).toEqual(Object.keys(snap).sort());
    expect(exp.tables.syncQueue).toEqual(snap.syncQueue);
    expect(exp.tables.workoutLogs).toEqual(snap.workoutLogs);
    expect(JSON.parse(JSON.stringify(exp))).toStrictEqual(exp);
    expect(exp.tables.workoutLogs).not.toBe(snap.workoutLogs);
  });
});

describe('migrateSnapshotV2toV3 activeProfileId', () => {
  it('falls back to the first produced profile when family members exist without any user row', () => {
    const result = migrateSnapshotV2toV3(
      { familyMembers: [{ id: 'fm-1', profileId: 'gone', name: 'Kid', createdAt: '2026-01-05T00:00:00.000Z' }] },
      CTX,
    );
    expect(result.tables.profiles.map((p) => p.id)).toEqual(['fm-1']);
    expect(result.activeProfileId).toBe('fm-1');
  });

  it('is null only when no profile was produced', () => {
    expect(migrateSnapshotV2toV3({}, CTX)).toMatchObject({ activeProfileId: null, tables: { profiles: [] } });
  });
});
