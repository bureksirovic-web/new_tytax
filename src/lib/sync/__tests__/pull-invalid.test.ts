import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, makeDevice } from './harness';

/**
 * A server row this client cannot map (e.g. a legacy 001 row whose
 * family_member_id 002 left null) is skipped, but the persisted pull cursor
 * never moves past it: every later run re-reads it, so it lands as soon as it
 * becomes mappable instead of being lost behind the cursor.
 */
describe('pull: an unmappable row holds the cursor', () => {
  it('re-reads a skipped row on later runs and applies it once it maps', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const a = makeDevice(remote);
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    await a.repo.bodyweight.add(profile.id, { date: '2026-03-01', valueKg: 70 });
    await a.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 71 });
    await a.adapter.syncNow();
    remote.advance(60_000); // later rows well outside the 5 s pull overlap
    await a.repo.bodyweight.add(profile.id, { date: '2026-03-03', valueKg: 72 });
    await a.adapter.syncNow();
    expect(remote.rows('bodyweight_entries')).toHaveLength(3);

    const bad = remote.rows('bodyweight_entries').find((r) => r.date === '2026-03-02');
    const table = remote.tables.get('bodyweight_entries');
    if (!bad || !table) throw new Error('fixture: row missing');
    table.set(String(bad.id), { ...bad, family_member_id: null });

    const b = makeDevice(remote);
    await b.adapter.syncNow();
    const datesOnB = async () => (await b.repo.bodyweight.list(profile.id)).map((e) => e.date).sort();
    expect(await datesOnB()).toEqual(['2026-03-01', '2026-03-03']);
    expect(b.logs).toContainEqual(expect.objectContaining({ event: 'skip', table: 'bodyweight_entries', code: 'invalid_row' }));

    // The row becomes mappable (fixed server-side, updated_at unchanged): the next run picks it up.
    table.set(String(bad.id), bad);
    await b.adapter.syncNow();
    expect(await datesOnB()).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});
