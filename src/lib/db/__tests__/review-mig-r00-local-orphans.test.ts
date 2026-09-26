/**
 * Review R00 (S2): a real v2 database never had a profile row; every table
 * wrote profileId 'local' and a family member's logs carried familyMemberId.
 * After the v3 upgrade a live profile must own every row, the family member
 * must be its own profile, and ensureActive must pick the migrated profile.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';
import { CTX, v2FamilyLog, v2Log } from '../migrations/__tests__/fixture';
import { dbName, dump, seedLegacy } from '../migrations/__tests__/v2-db';

const clock = () => new Date(CTX.now);
const AT = '2026-03-01T10:00:00.000Z';

const program = (id: string, isActive: boolean) => ({
  id,
  profileId: 'local',
  name: `Prog ${id}`,
  splitType: 'full_body',
  weeks: 4,
  sessions: [],
  isActive,
  createdAt: AT,
  updatedAt: AT,
});

async function seedLocalOnly(name: string): Promise<void> {
  await seedLegacy(name, {
    familyMembers: [{ id: 'fm-1', profileId: 'local', name: 'Kid', createdAt: AT }],
    workoutLogs: [v2Log(), v2FamilyLog()],
    programs: [program('p-1', false), program('p-2', true)],
    prRecords: [
      { id: 'pr-1', profileId: 'local', exerciseId: 'bench', exerciseName: 'Bench Press', prType: 'weight', value: 62.5, achievedAt: AT, workoutLogId: 'log-1' },
    ],
    bodyweightEntries: [{ id: 'bw-1', profileId: 'local', date: '2026-03-01', weightKg: 80, createdAt: AT }],
    exerciseNotes: [{ id: 'n-1', profileId: 'local', exerciseId: 'bench', note: 'elbows in', updatedAt: AT }],
    arsenal: [{ id: 'bench-press', profileId: 'local', addedAt: AT, name: 'Bench' }],
  });
}

describe('R00: v2 data under profileId local with no profile row', () => {
  it('every row gets a live owner, family member becomes a profile, active program + active profile set', async () => {
    const name = dbName('r00-local');
    await seedLocalOnly(name);
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId });
    await db.open();

    const all = await dump(db);
    const profiles = await db.profiles.toArray();
    expect(profiles.map((p) => p.id).sort()).toEqual(['fm-1', 'synth-1']);
    expect(profiles.every((p) => !p.deletedAt)).toBe(true);
    const primary = profiles.find((p) => p.id === 'synth-1');
    const member = profiles.find((p) => p.id === 'fm-1');
    expect(member?.name).toBe('Kid');

    // No 'local' left anywhere in any v3 table.
    for (const table of ['workoutLogs', 'programs', 'prRecords', 'bodyweightEntries', 'exerciseNotes', 'arsenal']) {
      expect(all[table].length, table).toBeGreaterThan(0);
      for (const row of all[table] as Array<{ profileId: string }>) {
        expect(['synth-1', 'fm-1'], `${table} owner`).toContain(row.profileId);
      }
    }
    expect(JSON.stringify(Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'meta')))).not.toContain('"local"');

    expect((await db.workoutLogs.get('log-1'))?.profileId).toBe('synth-1');
    expect((await db.workoutLogs.get('log-2'))?.profileId).toBe('fm-1');
    expect(primary?.activeProgramId).toBe('p-2');
    expect((await db.programs.get('p-2'))?.profileId).toBe('synth-1');
    expect((await db.meta.get('activeProfileId'))?.value).toBe('synth-1');

    const repo = createRepository({ db, now: clock });
    const active = await repo.profiles.ensureActive('Profil 1');
    expect(active.id).toBe('synth-1');
    expect(await db.profiles.count()).toBe(2);
    expect((await repo.logs.list('synth-1')).map((l) => l.id)).toEqual(['log-1']);
    expect((await repo.logs.list('fm-1')).map((l) => l.id)).toEqual(['log-2']);
    db.close();
  });

  it('ensureActive picks the migrated profile even if the meta pointer was lost', async () => {
    const name = dbName('r00-nometa');
    await seedLocalOnly(name);
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId });
    await db.open();
    await db.meta.delete('activeProfileId');
    const repo = createRepository({ db, now: clock });
    const active = await repo.profiles.ensureActive('Profil 1');
    expect(['synth-1', 'fm-1']).toContain(active.id);
    expect(await db.profiles.count()).toBe(2);
    db.close();
  });
});
