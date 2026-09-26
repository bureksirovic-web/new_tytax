/**
 * importLegacy edge cases found by refuters:
 * - two legacy users merged into one profile keep separate ids (legacyIdScope);
 * - the PR recompute stays correct when the import clock is behind stored PR rows.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { PRRecord } from '@/contracts';
import { draft, exercise, freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { importId, importLegacy, legacyIdScope, LEGACY_IMPORT_NAMESPACE, uuidV5 } from '..';
import { MULTI_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';
import { syntheticResolver } from '../service/__fixtures__/testing';
import { planPRs, stampAfter } from '../service/prs';

const TEXT = loadFixtureText(MULTI_USER_DUMP.file);
const STAMP = '2026-09-26T08:00:00.000Z';
const DAY = 86_400_000;

describe('importLegacy: a second legacy user into a profile that already holds another one', () => {
  it('inserts all of the second user\'s rows and keeps the first user\'s plan active', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'Merged' });
    const opts = (username: string) => ({ users: [{ username, target: { profileId: p.id } }], resolver: syntheticResolver(), now: () => STAMP });
    const ana = (await importLegacy(repo, TEXT, opts('Ana'))).perUser[0];
    const marko = (await importLegacy(repo, TEXT, opts('Marko Horvat'))).perUser[0];
    const none = { updated: 0, skipped: 0 };
    expect({ programs: marko.programs, bodyweight: marko.bodyweight, logs: marko.logs }).toEqual({
      programs: { inserted: 1, ...none },
      bodyweight: { inserted: 1, ...none },
      logs: { inserted: 2, ...none },
    });
    const planOf = (u: string) => importId(legacyIdScope(p.id, u), 'program', 'plan');
    expect(planOf('Ana')).not.toBe(planOf('Marko Horvat'));
    expect(ana.activatedProgramId).toBe(planOf('Ana'));
    expect(marko.activatedProgramId).toBeNull();
    expect((await repo.programs.getActive(p.id))?.id).toBe(planOf('Ana'));
    const ids = (await repo.programs.list(p.id)).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([planOf('Ana'), planOf('Marko Horvat')]));

    const again = (await importLegacy(repo, TEXT, opts('Marko Horvat'))).perUser[0];
    expect({ programs: again.programs, bodyweight: again.bodyweight, logs: again.logs }).toEqual({
      programs: { inserted: 0, updated: 0, skipped: 1 },
      bodyweight: { inserted: 0, updated: 0, skipped: 1 },
      logs: { inserted: 0, updated: 0, skipped: 2 },
    });
  });

  it('legacyIdScope encodes the username so a "|" in it cannot forge another scope', () => {
    expect(legacyIdScope('p', 'a|b')).toBe('p|user:a%7Cb');
    expect(importId(legacyIdScope('p', 'a|log'), 'set', 'x')).not.toBe(importId(legacyIdScope('p', 'a'), 'log', 'set|x'));
  });
});

describe('importLegacy: PR recompute when the import clock is behind the stored PR rows', () => {
  it('the reported soft-deletes are actually written (tombstones stamped after the stored rows)', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'Existing' });
    await t.repo.finishWorkout(draft('d1', p.id, [exercise('u1', 't-bench', [{ kg: 50, reps: 5 }])]));
    const storedD1 = (await t.repo.prs.list(p.id)).filter((r) => r.workoutLogId === 'd1');
    expect(storedD1).toHaveLength(2);
    t.tick(DAY);
    const ana = (
      await importLegacy(t.repo, TEXT, {
        users: [{ username: 'Ana', target: { profileId: p.id } }],
        resolver: syntheticResolver(),
        now: () => new Date(T0.getTime() - DAY).toISOString(),
      })
    ).perUser[0];
    expect(ana.prRecords.updated).toBe(2);
    const all: PRRecord[] = await t.repo.prs.list(p.id, { includeDeleted: true });
    const d1 = all.filter((r) => r.workoutLogId === 'd1');
    expect(d1.map((r) => r.deletedAt)).toEqual(storedD1.map((r) => stampAfter('2000-01-01T00:00:00.000Z', r.updatedAt)));
    expect(d1.every((r) => r.updatedAt === r.deletedAt && Date.parse(r.updatedAt) > Date.parse(storedD1[0].updatedAt))).toBe(true);
    expect(all.filter((r) => !r.deletedAt)).toHaveLength(ana.prRecords.inserted);
  });

  it('stampAfter keeps a newer stamp and otherwise moves 1 ms past the stored row', () => {
    expect(stampAfter(STAMP, '2026-01-01T00:00:00.000Z')).toBe(STAMP);
    expect(stampAfter(STAMP, STAMP)).toBe('2026-09-26T08:00:00.001Z');
    expect(stampAfter(STAMP, '2027-01-01T00:00:00.000Z')).toBe('2027-01-01T00:00:00.001Z');
    expect(stampAfter(STAMP, undefined)).toBe(STAMP);
    expect(stampAfter(STAMP, 'garbage')).toBe(STAMP);
  });

  it('a desired record whose id is a newer soft-deleted row is revived after it, counted as updated', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'P' });
    await t.repo.finishWorkout(draft('d1', p.id, [exercise('u1', 't-bench', [{ kg: 50, reps: 5 }])]));
    const log = (await t.repo.exportBackup(p.id)).workoutLogs[0];
    const id = uuidV5(`${p.id}|pr|d1|t-bench|e1rm`, LEGACY_IMPORT_NAMESPACE);
    const later = '2030-01-01T00:00:00.000Z';
    const dead: PRRecord = { ...(await t.repo.prs.list(p.id))[0], id, prType: 'e1rm', createdAt: STAMP, updatedAt: later, deletedAt: later };
    const plan = planPRs(p.id, [], [log], [dead], STAMP);
    const revived = plan.records.find((r) => r.id === id);
    expect(revived).toMatchObject({ id, createdAt: STAMP, updatedAt: '2030-01-01T00:00:00.001Z', workoutLogId: 'd1' });
    expect(revived?.deletedAt).toBeUndefined();
    expect(plan.counts).toEqual({ inserted: plan.records.length - 1, updated: 1, skipped: 0 });
  });
});
