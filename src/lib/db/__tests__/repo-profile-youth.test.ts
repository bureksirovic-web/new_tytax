/**
 * Family-profiles plan: `CreateProfileInput.birthYear`/`experienceLevel` are
 * persisted on create, and `birthYear` is validated 1920..the current year
 * (by the repo's injected clock) on both create and update.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { expectCode, freshRepo } from './helpers';

describe('profiles.create: birthYear / experienceLevel', () => {
  it('persists birthYear and experienceLevel from CreateProfileInput', async () => {
    const { repo } = freshRepo();
    const kao = await repo.profiles.create({ name: 'Kao', birthYear: 2015, experienceLevel: 'beginner' });
    expect(kao.birthYear).toBe(2015);
    expect(kao.experienceLevel).toBe('beginner');
    expect((await repo.profiles.get(kao.id))?.birthYear).toBe(2015);
  });

  it('omits birthYear/experienceLevel when not given', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'Tomi' });
    expect(p.birthYear).toBeUndefined();
    expect(p.experienceLevel).toBeUndefined();
  });

  it('rejects a birthYear out of 1920..current year, and a bad experienceLevel', async () => {
    const { repo, now } = freshRepo();
    const max = now().getFullYear();
    await expectCode(repo.profiles.create({ name: 'A', birthYear: 1919 }), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'A', birthYear: max + 1 }), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'A', birthYear: 2015.5 }), 'VALIDATION');
    await expectCode(repo.profiles.create({ name: 'A', experienceLevel: 'expert' as never }), 'VALIDATION');
    const ok = await repo.profiles.create({ name: 'A', birthYear: max });
    expect(ok.birthYear).toBe(max);
  });
});

describe('profiles.update: birthYear', () => {
  it('sets and clears birthYear (an explicit undefined clears it, repo convention)', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'Kao' });
    const withYear = await repo.profiles.update(p.id, { birthYear: 2015 });
    expect(withYear.birthYear).toBe(2015);
    const cleared = await repo.profiles.update(p.id, { birthYear: undefined });
    expect(cleared.birthYear).toBeUndefined();
  });

  it('rejects an out-of-range birthYear', async () => {
    const { repo, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'Kao' });
    await expectCode(repo.profiles.update(p.id, { birthYear: 1919 }), 'VALIDATION');
    await expectCode(repo.profiles.update(p.id, { birthYear: now().getFullYear() + 1 }), 'VALIDATION');
  });
});
