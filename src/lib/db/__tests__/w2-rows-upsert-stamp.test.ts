/**
 * rows.ts write helpers behind the PR rebuild: laterStamp (LWW-safe stamps)
 * and upsertRows (bulkPut, or clear + refill when the writes cover >= half
 * of the table). The refill must keep every other row and stay atomic.
 *
 * Hand-derived: A 100x5, B 110x5 (weight 110 > 100, e1rm 123.75 > 112.5 -> 2 PRs).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { PRRecord } from '@/contracts/domain';
import { laterStamp, upsertRows } from '../repo/rows';
import { draft, exercise, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

describe('laterStamp', () => {
  it('keeps the stamp when the previous one is older or missing, else previous + 1 ms', () => {
    const now = '2026-03-02T12:00:00.000Z';
    expect(laterStamp(now, undefined)).toBe(now);
    expect(laterStamp(now, 'garbage')).toBe(now);
    expect(laterStamp(now, '2026-03-02T11:59:59.999Z')).toBe(now);
    expect(laterStamp(now, now)).toBe('2026-03-02T12:00:00.001Z');
    expect(laterStamp(now, '2027-01-01T00:00:00.000Z')).toBe('2027-01-01T00:00:00.001Z');
  });
});

async function finish(t: TestRepo, id: string, pid: string, kg: number) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, pid, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

const sortById = (rows: PRRecord[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));

describe('upsertRows', () => {
  it('small write set: bulkPut, other rows untouched', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finish(t, 'A', pid, 100);
    await finish(t, 'B', pid, 110);
    const before = sortById(await t.db.prRecords.toArray()); // 4 rows: A 2 baselines, B 2 PRs
    const changed = { ...before[0], value: 999 };
    await t.db.transaction('rw', t.db.prRecords, () => upsertRows(t.db.prRecords, [changed])); // 1 * 2 < 4
    expect(sortById(await t.db.prRecords.toArray())).toEqual([changed, ...before.slice(1)]);
  });

  it('large write set: clear + refill keeps rows of other profiles and adds new ones', async () => {
    const t = freshRepo();
    const p = (await t.repo.profiles.create({ name: 'P' })).id;
    const q = (await t.repo.profiles.create({ name: 'Q' })).id;
    await finish(t, 'A', p, 100);
    await finish(t, 'Q1', q, 80);
    const before = sortById(await t.db.prRecords.toArray()); // 4 rows: 2 of P, 2 of Q
    const ofP = before.filter((r) => r.profileId === p).map((r) => ({ ...r, value: r.value + 1 }));
    const fresh = { ...ofP[0], id: 'zz-new' };
    await t.db.transaction('rw', t.db.prRecords, () => upsertRows(t.db.prRecords, [...ofP, fresh])); // 3 * 2 >= 4
    const after = sortById(await t.db.prRecords.toArray());
    expect(after).toEqual(sortById([...before.filter((r) => r.profileId === q), ...ofP, fresh]));
  });

  it('a throw after the refill rolls the cleared table back', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finish(t, 'A', pid, 100);
    const before = sortById(await t.db.prRecords.toArray());
    const failing = t.db.transaction('rw', t.db.prRecords, async () => {
      await upsertRows(t.db.prRecords, [{ ...before[0], value: 1 }, { ...before[1], value: 1 }]);
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    expect(sortById(await t.db.prRecords.toArray())).toEqual(before);
  });

  it('a PR rewrite of one profile keeps the other profile readable and unchanged', async () => {
    const t = freshRepo();
    const p = (await t.repo.profiles.create({ name: 'P' })).id;
    const q = (await t.repo.profiles.create({ name: 'Q' })).id;
    await finish(t, 'Q1', q, 80);
    await finish(t, 'A', p, 100);
    await finish(t, 'B', p, 110);
    const qRows = await t.repo.prs.list(q);
    t.tick();
    await t.repo.logs.softDelete(p, 'A'); // B becomes the baseline: its 2 PR rows are rewritten in place
    expect(await t.repo.prs.list(q)).toEqual(qRows);
    expect((await t.repo.logs.get(p, 'B'))?.prCount).toBe(0);
  });
});
