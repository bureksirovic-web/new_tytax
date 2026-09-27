import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import type { SetupPayload } from '@/lib/setup-link';
import { applySetupPayload, type ApplySetupOptions } from '../setup-actions';

const DEFAULT_PROFILE_NAME = 'Profil 1';
const opts: ApplySetupOptions = { defaultProfileName: DEFAULT_PROFILE_NAME, fallbackLanguage: 'hr' };

let dbCount = 0;
let repo: Repository;

beforeEach(() => {
  dbCount += 1;
  repo = createRepository({ db: new TytaxDatabase(`setup-actions-test-${dbCount}`) });
});

const payload: SetupPayload = {
  v: 1,
  profiles: [
    { name: 'Ana', presetId: 'tytax-balanced-6day', language: 'hr' },
    { name: 'Leo', birthYear: 2015, experienceLevel: 'beginner', presetId: 'bw-fundamentals' },
  ],
};

describe('applySetupPayload: fresh device', () => {
  it('creates every profile, installs its preset active, and activates the first one', async () => {
    const results = await applySetupPayload(repo, payload, opts);

    expect(results.map((r) => r.status)).toEqual(['created', 'created']);
    const profiles = await repo.profiles.list();
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.name).sort()).toEqual(['Ana', 'Leo']);

    const ana = profiles.find((p) => p.name === 'Ana')!;
    const leo = profiles.find((p) => p.name === 'Leo')!;
    expect((await repo.programs.getActive(ana.id))?.presetId).toBe('tytax-balanced-6day');
    expect((await repo.programs.getActive(leo.id))?.presetId).toBe('bw-fundamentals');
    expect(leo.birthYear).toBe(2015);
    expect(leo.experienceLevel).toBe('beginner');
    expect(await repo.profiles.getActiveId()).toBe(ana.id);
  });

  it('is idempotent: reopening the same link skips every profile', async () => {
    await applySetupPayload(repo, payload, opts);
    const secondRun = await applySetupPayload(repo, payload, opts);

    expect(secondRun.map((r) => r.status)).toEqual(['skipped', 'skipped']);
    expect(await repo.profiles.list()).toHaveLength(2);
  });

  it('mixed rerun: the first payload profile stays active even when it is skipped and a later one is created', async () => {
    await applySetupPayload(repo, { v: 1, profiles: [payload.profiles[0]] }, opts);
    const ana = (await repo.profiles.list()).find((p) => p.name === 'Ana')!;
    const rerun = await applySetupPayload(repo, payload, opts);

    expect(rerun.map((r) => r.status)).toEqual(['skipped', 'created']);
    expect(await repo.profiles.list()).toHaveLength(2);
    expect(await repo.profiles.getActiveId()).toBe(ana.id);
  });
});

describe('applySetupPayload: ADOPT rule (amendments after 1b, blocker 1)', () => {
  it('renames an untouched default profile into the first setup profile', async () => {
    const original = await repo.profiles.create({ name: DEFAULT_PROFILE_NAME });

    const results = await applySetupPayload(repo, payload, opts);

    expect(results[0]).toMatchObject({ status: 'adopted', profileId: original.id });
    expect(results[1].status).toBe('created');
    const profiles = await repo.profiles.list();
    expect(profiles).toHaveLength(2);
    const adopted = await repo.profiles.get(original.id);
    expect(adopted?.name).toBe('Ana');
    expect((await repo.programs.getActive(original.id))?.presetId).toBe('tytax-balanced-6day');
  });

  it('does not adopt a default-named profile that already has workout history', async () => {
    const original = await repo.profiles.create({ name: DEFAULT_PROFILE_NAME });
    await repo.importBackup({
      format: 'tytax-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      profiles: [],
      workoutLogs: [
        {
          id: 'log-1',
          profileId: original.id,
          sessionName: 'Old session',
          date: '2026-01-01',
          startedAt: '2026-01-01T10:00:00.000Z',
          finishedAt: '2026-01-01T11:00:00.000Z',
          durationSeconds: 3600,
          exercises: [],
          totalVolumeKg: 0,
          totalSets: 0,
          prCount: 0,
          modalitiesUsed: [],
          createdAt: '2026-01-01T11:00:00.000Z',
          updatedAt: '2026-01-01T11:00:00.000Z',
        },
      ],
      programs: [],
      prRecords: [],
      bodyweightEntries: [],
      exerciseNotes: [],
      arsenal: [],
      equipment: [],
    });

    const results = await applySetupPayload(repo, payload, opts);

    expect(results.every((r) => r.status === 'created')).toBe(true);
    expect(await repo.profiles.list()).toHaveLength(3);
    expect((await repo.profiles.get(original.id))?.name).toBe(DEFAULT_PROFILE_NAME);
  });

  it('does not adopt a default-named profile that already has an active program', async () => {
    const original = await repo.profiles.create({ name: DEFAULT_PROFILE_NAME });
    await repo.programs.create(
      original.id,
      { name: 'Existing', splitType: 'custom', frequency: 1, periodizationType: 'none', sessionOrder: [], sessions: [], modalitiesUsed: [], isPreset: false, currentSessionIndex: 0 },
      { activate: true },
    );

    const results = await applySetupPayload(repo, payload, opts);

    expect(results.every((r) => r.status === 'created')).toBe(true);
    expect(await repo.profiles.list()).toHaveLength(3);
  });

  it('does not adopt a profile with a different (non-default) name', async () => {
    const original = await repo.profiles.create({ name: 'Someone Else' });

    const results = await applySetupPayload(repo, payload, opts);

    expect(results.every((r) => r.status === 'created')).toBe(true);
    expect(await repo.profiles.list()).toHaveLength(3);
    expect((await repo.profiles.get(original.id))?.name).toBe('Someone Else');
  });

  it('never adopts when the device already has more than one profile', async () => {
    await repo.profiles.create({ name: DEFAULT_PROFILE_NAME });
    await repo.profiles.create({ name: 'Another' });

    const results = await applySetupPayload(repo, payload, opts);

    expect(results.every((r) => r.status === 'created')).toBe(true);
    expect(await repo.profiles.list()).toHaveLength(4);
  });
});

describe('applySetupPayload: same name, different preset', () => {
  it('creates a new profile rather than skipping (name alone never matches)', async () => {
    const existing = await repo.profiles.create({ name: 'Ana' });
    await repo.programs.create(existing.id, { name: 'Other', splitType: 'custom', frequency: 1, periodizationType: 'none', sessionOrder: [], sessions: [], modalitiesUsed: [], isPreset: true, presetId: 'some-other-preset', currentSessionIndex: 0 }, { activate: true });

    const results = await applySetupPayload(repo, { v: 1, profiles: [payload.profiles[0]] }, opts);

    expect(results[0].status).toBe('created');
    expect(await repo.profiles.list()).toHaveLength(2);
  });
});

describe('applySetupPayload: duplicate same-name profiles already on the device', () => {
  it('skips when ANY same-name profile already has the preset active (not only the first match)', async () => {
    // Device state made by hand: two "Ana" profiles, only the second has the balanced preset active.
    const first = await repo.profiles.create({ name: 'Ana' });
    await repo.programs.create(first.id, (await import('@/lib/programs/presets')).getPresetById('bw-fundamentals')!, { activate: true });
    const second = await repo.profiles.create({ name: 'ana' });
    await repo.programs.create(second.id, (await import('@/lib/programs/presets')).getPresetById('tytax-balanced-6day')!, { activate: true });

    const results = await applySetupPayload(repo, { v: 1, profiles: [payload.profiles[0]] }, opts);
    expect(results.map((r) => [r.status, r.profileId])).toEqual([['skipped', second.id]]);
    expect(await repo.profiles.list()).toHaveLength(2);
  });
});
