import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { BackupV3 } from '@/contracts/repo';
import { exercise, draft, freshRepo, template, T0, expectCode } from './helpers';

describe('profiles', () => {
  it('create merges settings over the defaults, copies arrays and stamps timestamps', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: '  Ana ', settings: { units: 'lb', restSeconds: 120 } });
    expect(p.name).toBe('Ana');
    expect(p.settings).toEqual({ ...DEFAULT_PROFILE_SETTINGS, units: 'lb', restSeconds: 120 });
    expect(p.settings.plateSetKg).not.toBe(DEFAULT_PROFILE_SETTINGS.plateSetKg);
    expect(p.activeProgramId).toBeNull();
    expect(p.createdAt).toBe(T0.toISOString());
    expect(p.updatedAt).toBe(T0.toISOString());
    expect(await repo.profiles.get(p.id)).toEqual(p);
  });

  it('rejects an empty name and bad settings with VALIDATION', async () => {
    const { repo } = freshRepo();
    await expectCode(repo.profiles.create({ name: '   ' }), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'X', settings: { barWeightKg: -5 } }), 'VALIDATION');
    expect(await repo.profiles.list()).toEqual([]);
  });

  it('ensureActive creates the default profile once, then keeps returning it', async () => {
    const { repo } = freshRepo();
    const [a, b] = await Promise.all([repo.profiles.ensureActive('Me'), repo.profiles.ensureActive('Me')]);
    expect(a.id).toBe(b.id);
    expect(a.name).toBe('Me');
    expect(await repo.profiles.getActiveId()).toBe(a.id);
    const again = await repo.profiles.ensureActive('Other');
    expect(again.id).toBe(a.id);
    expect(await repo.profiles.list()).toHaveLength(1);
  });

  it('ensureActive replaces a stale active id with the first existing profile', async () => {
    const { repo, db, tick } = freshRepo();
    const first = await repo.profiles.create({ name: 'First' });
    tick();
    await repo.profiles.create({ name: 'Second' });
    await db.meta.put({ key: 'activeProfileId', value: 'ghost' });
    expect(await repo.profiles.getActiveId()).toBeNull();
    const active = await repo.profiles.ensureActive('Me');
    expect(active.id).toBe(first.id);
    expect(await repo.profiles.getActiveId()).toBe(first.id);
    expect(await repo.profiles.list()).toHaveLength(2);
  });

  it('setActive validates the id; update/updateSettings stamp updatedAt', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'Ana' });
    await expectCode(repo.profiles.setActive('nope'), 'NOT_FOUND');
    await repo.profiles.setActive(p.id);
    expect(await repo.profiles.getActiveId()).toBe(p.id);

    tick(5000);
    const s = await repo.profiles.updateSettings(p.id, { theme: 'oled', plateSetKg: [20, 10] });
    expect(s.settings.theme).toBe('oled');
    expect(s.settings.plateSetKg).toEqual([20, 10]);
    expect(s.settings.units).toBe('kg');
    expect(s.updatedAt).toBe(now().toISOString());
    expect(s.createdAt).toBe(p.createdAt);

    const renamed = await repo.profiles.update(p.id, { name: 'Ana B', bodyweightKg: 61 });
    expect(renamed.name).toBe('Ana B');
    expect(renamed.settings.theme).toBe('oled');
    await expectCode(repo.profiles.update(p.id, { name: '' }), 'VALIDATION');
    await expectCode(repo.profiles.update('nope', { name: 'X' }), 'NOT_FOUND');
    await expectCode(repo.profiles.updateSettings(p.id, { units: 'stone' as 'kg' }), 'VALIDATION');
  });
});

describe('backup export/import', () => {
  it('round-trips and is idempotent by id', async () => {
    const src = freshRepo();
    const p = await src.repo.profiles.create({ name: 'A' });
    await src.repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await src.repo.programs.create(p.id, template(2), { activate: true });
    await src.repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    const backup = await src.repo.exportBackup();
    expect(backup.format).toBe('tytax-backup');
    // 1 profile + 1 log + 1 program + 2 PRs + 1 bodyweight = 6 rows
    const total = backup.profiles.length + backup.workoutLogs.length + backup.programs.length + backup.prRecords.length + backup.bodyweightEntries.length;
    expect(total).toBe(6);

    const dst = freshRepo();
    expect(await dst.repo.importBackup(backup)).toEqual({ inserted: 6, updated: 0 });
    expect(await dst.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect(await dst.repo.logs.list(p.id)).toEqual(await src.repo.logs.list(p.id));
    expect((await dst.repo.programs.getActive(p.id))?.name).toBe('2-day split');
  });

  it('exports one profile only when asked, and rejects a wrong format or version', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    await repo.bodyweight.add(b.id, { date: '2026-03-01', valueKg: 80 });
    const onlyA = await repo.exportBackup(a.id);
    expect(onlyA.profiles.map((x) => x.id)).toEqual([a.id]);
    expect(onlyA.bodyweightEntries).toEqual([]);
    await expectCode(repo.importBackup({ ...onlyA, version: 2 } as unknown as BackupV3), 'VALIDATION');
    await expectCode(repo.importBackup({ ...onlyA, format: 'other' } as unknown as BackupV3), 'VALIDATION');
    await expectCode(repo.importBackup({ ...onlyA, workoutLogs: 'x' } as unknown as BackupV3), 'VALIDATION');
  });
});
