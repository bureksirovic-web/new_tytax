/**
 * v2 -> v3 upgrade against what real v2 databases look like: no profile row
 * (data under 'local'), settings only in localStorage, arsenal keyed by
 * catalog slug, and soft-deleted logs that set PRs.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LegacyWorkoutLogV2 } from '@/contracts/domain';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';
import { stableUuid } from '../migrations/stable-id';
import { CTX, v2Log, v2User } from '../migrations/__tests__/fixture';
import { dbName, seedLegacy } from '../migrations/__tests__/v2-db';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const clock = () => new Date(CTX.now);

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('v3 upgrade without crypto.randomUUID (plain-http LAN origin)', () => {
  it('opens a v2 db holding only local rows and gives the new primary profile a uuid', async () => {
    const name = dbName('lan-nouuid');
    await seedLegacy(name, { workoutLogs: [v2Log()] });
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(typeof globalThis.crypto.randomUUID).toBe('undefined');
    const db = new TytaxDatabase(name, { now: clock });
    await db.open();
    const profiles = await db.profiles.toArray();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toMatch(UUID_V4);
    expect((await db.workoutLogs.get('log-1'))?.profileId).toBe(profiles[0].id);
    expect((await db.meta.get('activeProfileId'))?.value).toBe(profiles[0].id);
    db.close();
  });
});

describe('v3 upgrade keeps v2 device settings from localStorage', () => {
  async function upgradeLocalOnly(prefix: string, opts: ConstructorParameters<typeof TytaxDatabase>[1] = {}) {
    const name = dbName(prefix);
    await seedLegacy(name, { workoutLogs: [v2Log()] });
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId, ...opts });
    await db.open();
    const profiles = await db.profiles.toArray();
    db.close();
    return profiles;
  }

  it('imperial / en / oled become lb / en / oled on the synthesised profile', async () => {
    window.localStorage.setItem('units', 'imperial');
    window.localStorage.setItem('locale', 'en');
    window.localStorage.setItem('theme', 'oled');
    const [profile] = await upgradeLocalOnly('dev-imperial');
    expect(profile.id).toBe('synth-1');
    expect({ u: profile.settings.units, l: profile.settings.language, t: profile.settings.theme }).toEqual({ u: 'lb', l: 'en', t: 'oled' });
  });

  it('no keys: the v2 UI defaults (metric, English, dark) not the v3 contract default language', async () => {
    const [profile] = await upgradeLocalOnly('dev-empty');
    expect({ u: profile.settings.units, l: profile.settings.language, t: profile.settings.theme }).toEqual({ u: 'kg', l: 'en', t: 'tactical' });
  });

  it('a Croatian v2 device stays Croatian', async () => {
    window.localStorage.setItem('locale', 'hr');
    const [profile] = await upgradeLocalOnly('dev-hr');
    expect(profile.settings.language).toBe('hr');
  });

  it('storage that throws falls back to contract defaults instead of aborting the upgrade', async () => {
    const [profile] = await upgradeLocalOnly('dev-throw', { legacyDeviceSettings: () => undefined });
    expect({ u: profile.settings.units, l: profile.settings.language }).toEqual({ u: 'kg', l: 'hr' });
  });

  it('a v2 profile row keeps its own stored values over the device ones', async () => {
    window.localStorage.setItem('units', 'metric');
    window.localStorage.setItem('locale', 'hr');
    const name = dbName('dev-row');
    await seedLegacy(name, { profiles: [v2User()], workoutLogs: [v2Log()] });
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId });
    await db.open();
    const [profile] = await db.profiles.toArray();
    expect({ id: profile.id, u: profile.settings.units, l: profile.settings.language }).toEqual({ id: 'u-1', u: 'lb', l: 'en' });
    db.close();
  });
});

describe('v3 upgrade re-keys slug arsenal rows and tombstones PRs of deleted logs', () => {
  it('arsenal: uuid id derived from owner + exercise, slug kept as exerciseId', async () => {
    const name = dbName('arsenal-uuid');
    await seedLegacy(name, {
      profiles: [v2User()],
      arsenal: [{ id: 'bench-press', profileId: 'local', addedAt: '2026-03-01T10:00:00.000Z', name: 'Bench' }],
    });
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId });
    await db.open();
    const rows = await db.arsenal.toArray();
    expect(rows).toStrictEqual([
      {
        id: stableUuid('arsenal', 'u-1', 'bench-press'),
        profileId: 'u-1',
        exerciseId: 'bench-press',
        addedAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      },
    ]);
    expect(rows[0].id).toMatch(UUID_V4);
    db.close();
  });

  it('a PR set by a soft-deleted v2 log is tombstoned with the log stamp, and restore revives it', async () => {
    const name = dbName('pr-deleted-log');
    const deletedAt = '2026-03-05T10:00:00.000Z';
    const deletedLog: LegacyWorkoutLogV2 = { ...v2Log(), deletedAt };
    const pr = {
      id: 'pr-1',
      profileId: 'local',
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      prType: 'weight',
      value: 500,
      achievedAt: '2026-03-01T10:30:00.000Z',
      workoutLogId: 'log-1',
    };
    await seedLegacy(name, { profiles: [v2User()], workoutLogs: [deletedLog], prRecords: [pr] });
    const db = new TytaxDatabase(name, { now: clock, newId: CTX.newId });
    await db.open();
    const repo = createRepository({ db, now: clock });
    expect(await repo.logs.get('u-1', 'log-1')).toBeUndefined();
    expect(await repo.prs.list('u-1')).toEqual([]);
    const stored = await db.prRecords.get('pr-1');
    expect({ d: stored?.deletedAt, u: stored?.updatedAt }).toEqual({ d: deletedAt, u: deletedAt });

    await repo.logs.restore('u-1', 'log-1');
    const revived = await repo.prs.list('u-1');
    // Restore reuses pr-1's id and re-derives the log (only live log -> all baselines), newest achievedAt first:
    // KB swing weight 24 (s-5, 09:05; 24x15 has reps > 12, so no e1rm row); bench weight: done working
    // sets 60, 62.5, 50 (65 not done) -> 62.5 (s-3, 09:03) corrects pr-1's stale 500; bench e1rm (reps <= 12):
    // 60x8 = 60*36/29 = 74.48 > 62.5x6 = 72.58 > 50x10 = 66.67 -> the 60 kg set (s-2, 09:02).
    expect(revived.map((p) => ({ kg: p.kg, prType: p.prType, deletedAt: p.deletedAt }))).toEqual([
      { kg: 24, prType: 'weight', deletedAt: undefined },
      { kg: 62.5, prType: 'weight', deletedAt: undefined },
      { kg: 60, prType: 'e1rm', deletedAt: undefined },
    ]);
    expect(revived[1].id).toBe('pr-1');
    db.close();
  });
});
