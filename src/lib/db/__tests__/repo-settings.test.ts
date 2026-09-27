import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type ProfileSettings } from '@/contracts/domain';
import { expectCode, fakeSync, freshRepo } from './helpers';

type BadPatch = Partial<Record<keyof ProfileSettings | 'bogus', unknown>>;

describe('profiles.updateSettings', () => {
  it('stores every setting the contract lists and keeps the rest', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    tick(60_000);
    const next = await repo.profiles.updateSettings(p.id, {
      units: 'lb',
      restSeconds: 150,
      warmupStrategy: 'pyramid',
      barWeightKg: 15,
      language: 'en',
      theme: 'oled',
      plateSetKg: [5, 25, 1.25],
      weakPointInjector: true,
      voiceCues: true,
    });
    // plates are stored heaviest first: [25, 5, 1.25]
    expect(next.settings).toEqual({
      units: 'lb',
      restSeconds: 150,
      warmupStrategy: 'pyramid',
      barWeightKg: 15,
      language: 'en',
      theme: 'oled',
      plateSetKg: [25, 5, 1.25],
      weakPointInjector: true,
      voiceCues: true,
    });
    expect(next.updatedAt).toBe(now().toISOString());
    expect((await repo.profiles.get(p.id))?.settings).toEqual(next.settings);

    const partial = await repo.profiles.updateSettings(p.id, { restSeconds: 0, warmupStrategy: 'none', barWeightKg: 0 });
    expect(partial.settings).toMatchObject({ units: 'lb', theme: 'oled', restSeconds: 0, warmupStrategy: 'none', barWeightKg: 0 });
  });

  it('accepts the boundaries 0 and 3600 s for restSeconds', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    expect((await repo.profiles.updateSettings(p.id, { restSeconds: 3600 })).settings.restSeconds).toBe(3600);
    expect((await repo.profiles.updateSettings(p.id, { restSeconds: 0 })).settings.restSeconds).toBe(0);
    expect((await repo.profiles.updateSettings(p.id, { plateSetKg: [] })).settings.plateSetKg).toEqual([]);
  });

  const bad: Array<[string, BadPatch]> = [
    ['negative bar weight', { barWeightKg: -5 }],
    ['absurd bar weight', { barWeightKg: 1000 }],
    ['NaN bar weight', { barWeightKg: Number.NaN }],
    ['rest below 0', { restSeconds: -1 }],
    ['rest above 3600', { restSeconds: 3601 }],
    ['fractional rest', { restSeconds: 90.5 }],
    ['rest as string', { restSeconds: '90' }],
    ['unknown units', { units: 'stone' }],
    ['unknown language', { language: 'de' }],
    ['unknown warm-up strategy', { warmupStrategy: 'yolo' }],
    ['unknown theme', { theme: 'neon' }],
    ['plate of 0 kg', { plateSetKg: [20, 0] }],
    ['negative plate', { plateSetKg: [-2.5] }],
    ['plates not an array', { plateSetKg: 20 }],
    ['too many plates', { plateSetKg: Array.from({ length: 21 }, (_, i) => i + 1) }],
    ['injector as string', { weakPointInjector: 'yes' }],
    ['voice cues as number', { voiceCues: 1 }],
    ['unknown key', { bogus: true }],
    ['null patch', null as unknown as BadPatch],
  ];

  it.each(bad)('rejects %s with VALIDATION and stores nothing', async (_label, patch) => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    const queued = await repo.outbox.count();
    await expectCode(repo.profiles.updateSettings(p.id, patch as Partial<ProfileSettings>), 'VALIDATION');
    expect((await repo.profiles.get(p.id))?.settings).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(await repo.outbox.count()).toBe(queued);
  });

  it('validates settings passed to create, and updateSettings on a missing profile is NOT_FOUND', async () => {
    const { repo } = freshRepo();
    await expectCode(repo.profiles.create({ name: 'A', settings: { restSeconds: 5000 } }), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'A', settings: { theme: 'pink' as 'oled' } }), 'VALIDATION');
    await expectCode(repo.profiles.updateSettings('ghost', { units: 'lb' }), 'NOT_FOUND');
    expect(await repo.profiles.list()).toEqual([]);
  });

  it('ignores undefined values and never shares the default plate array', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A', settings: { units: undefined } });
    expect(p.settings.units).toBe('kg');
    const next = await repo.profiles.updateSettings(p.id, { theme: undefined, voiceCues: true });
    expect(next.settings.theme).toBe('tactical');
    expect(next.settings.plateSetKg).not.toBe(DEFAULT_PROFILE_SETTINGS.plateSetKg);
    expect(DEFAULT_PROFILE_SETTINGS.plateSetKg).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });
});
