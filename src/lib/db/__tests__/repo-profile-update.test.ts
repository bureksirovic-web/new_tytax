import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { Profile } from '@/contracts/domain';
import { expectCode, freshRepo, template } from './helpers';

type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'settings'>>;

describe('profiles.update', () => {
  it('stores profile fields and ignores id, createdAt, settings, deletedAt and updatedAt in the patch', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'A', avatarColor: 'amber', accountId: 'acc-1' });
    tick(1000);
    const sneaky = {
      name: 'Ana',
      gender: 'female',
      experienceLevel: 'advanced',
      bodyweightKg: 62.5,
      id: 'other',
      createdAt: 'x',
      settings: { units: 'lb' },
      deletedAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '1999-01-01T00:00:00.000Z',
    } as unknown as ProfilePatch;
    const next = await repo.profiles.update(p.id, sneaky);
    expect(next).toMatchObject({ id: p.id, name: 'Ana', gender: 'female', experienceLevel: 'advanced', bodyweightKg: 62.5 });
    expect(next.createdAt).toBe(p.createdAt);
    expect(next.updatedAt).toBe(now().toISOString());
    expect(next.settings.units).toBe('kg');
    expect(next.deletedAt).toBeUndefined();
    expect(await repo.profiles.get('other')).toBeUndefined();
    expect(next.avatarColor).toBe('amber');
    expect(next.accountId).toBe('acc-1');
  });

  it('rejects bad field values with VALIDATION', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const bad: ProfilePatch[] = [
      { name: '  ' },
      { bodyweightKg: 0 },
      { bodyweightKg: -70 },
      { gender: 'robot' as Profile['gender'] },
      { experienceLevel: 'god' as Profile['experienceLevel'] },
      { avatarColor: 5 as unknown as string },
      { accountId: {} as unknown as string },
    ];
    for (const patch of bad) await expectCode(repo.profiles.update(p.id, patch), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'B', avatarColor: 1 as unknown as string }), 'VALIDATION');
    expect(await repo.profiles.get(p.id)).toEqual(p);
  });

  it('activeProgramId must be a live program of the same profile (or null)', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const progA = await repo.programs.create(a.id, template(2));
    const progB = await repo.programs.create(b.id, template(2));

    await expectCode(repo.profiles.update(a.id, { activeProgramId: progB.id }), 'NOT_FOUND');
    await expectCode(repo.profiles.update(a.id, { activeProgramId: 'ghost' }), 'NOT_FOUND');
    expect((await repo.profiles.update(a.id, { activeProgramId: progA.id })).activeProgramId).toBe(progA.id);
    expect((await repo.profiles.update(a.id, { activeProgramId: null })).activeProgramId).toBeNull();

    await repo.programs.softDelete(a.id, progA.id);
    await expectCode(repo.profiles.update(a.id, { activeProgramId: progA.id }), 'NOT_FOUND');
    expect((await repo.profiles.get(b.id))?.activeProgramId).toBeNull();
  });

  it('list pages by createdAt, hides removed profiles unless includeDeleted', async () => {
    const { repo, tick } = freshRepo();
    const names = ['A', 'B', 'C'];
    for (const name of names) {
      await repo.profiles.create({ name });
      tick();
    }
    expect((await repo.profiles.list({ offset: 1, limit: 1 })).map((p) => p.name)).toEqual(['B']);
    expect((await repo.profiles.list({ limit: 0 })).length).toBe(0);
    const [a] = await repo.profiles.list();
    await repo.profiles.remove(a.id);
    expect((await repo.profiles.list()).map((p) => p.name)).toEqual(['B', 'C']);
    // hard delete when sync is off: nothing left to include
    expect(await repo.profiles.list({ includeDeleted: true })).toHaveLength(2);
  });

  it('getActiveId ignores an active id that points to a removed profile', async () => {
    const { repo, db } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    await repo.profiles.setActive(a.id);
    await db.profiles.update(a.id, { deletedAt: '2026-03-01T00:00:00.000Z' });
    expect(await repo.profiles.getActiveId()).toBeNull();
    expect(await repo.profiles.get(a.id)).toBeUndefined();
    await expectCode(repo.profiles.setActive(a.id), 'NOT_FOUND');
    const fresh = await repo.profiles.ensureActive('Me');
    expect(fresh.name).toBe('Me');
  });
});
