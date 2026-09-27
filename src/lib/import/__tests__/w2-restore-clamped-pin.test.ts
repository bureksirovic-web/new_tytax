/**
 * Far-future stamps are clamped to the restore clock (future-stamps.ts), which
 * moves on every restore. Refuter finding (Wave 2): the same hostile file then
 * beat the previous restore and every local edit made since, was re-written and
 * re-queued each time, and always needed confirmation again. Now a clamped row
 * never replaces a row this device already has (service/guards withoutPinnedRows);
 * a clamped row with a new id is added once.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3, Profile } from '@/contracts';
import { fakeSync, freshRepo, type TestRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, inspectBackupJson, restoreBackupJson } from '..';
import { snapshot } from '../service/__fixtures__/testing';

const FUTURE = '9999-12-31T23:59:59.999Z';
/** Device clock at setup; D1/D2 are the wall clocks of the two restore clicks. */
const D0 = new Date('2026-09-26T12:00:00.000Z');
const D1 = new Date(D0.getTime() + 60_000);
const D2 = new Date(D0.getTime() + 120_000);

interface Device extends TestRepo {
  ana: Profile;
  text: string;
}

/** Ana's device (sync on) and a hostile version of her backup: every row far-future, plus one new row. */
async function device(): Promise<Device> {
  const t = freshRepo({ sync: fakeSync(true), start: D0 });
  const ana = await t.repo.profiles.create({ name: 'Ana' });
  await t.repo.bodyweight.add(ana.id, { date: '2026-03-01', valueKg: 70 });
  const own = JSON.parse(await exportBackupJson(t.repo, ana.id)) as BackupV3;
  const bw = own.bodyweightEntries[0];
  const hostile: BackupV3 = {
    ...own,
    profiles: [{ ...own.profiles[0], name: 'owned', updatedAt: FUTURE }],
    bodyweightEntries: [
      { ...bw, valueKg: 111, updatedAt: FUTURE },
      { ...bw, id: 'bw-new', date: '2026-03-02', valueKg: 72, updatedAt: FUTURE },
    ],
  };
  return { ...t, ana, text: JSON.stringify(hostile) };
}

describe('a far-future-stamped backup restored twice', () => {
  it('never overwrites an existing row, and an applied file needs no confirmation again', async () => {
    const t = await device();
    const first = await restoreBackupJson(t.repo, t.text, { now: D1, confirmOverwrite: true });
    expect(first).toMatchObject({ inserted: 1, updated: 0, existingProfileIds: [t.ana.id] });
    expect((await t.repo.profiles.get(t.ana.id))?.name).toBe('Ana');
    expect((await t.repo.bodyweight.list(t.ana.id)).map((r) => r.valueKg).sort()).toEqual([70, 72]);

    const info = await inspectBackupJson(t.repo, t.text, { now: D2 });
    expect(info.requiresConfirmation, 'types.ts: an already-applied file needs no confirmation').toBe(false);
  });

  it('the second restore writes and queues nothing', async () => {
    const t = await device();
    await restoreBackupJson(t.repo, t.text, { now: D1, confirmOverwrite: true });
    const ops = await t.repo.outbox.count();
    const rows = await snapshot(t.repo, t.ana.id);

    const again = await restoreBackupJson(t.repo, t.text, { now: D2 });
    expect(again).toMatchObject({ inserted: 0, updated: 0 });
    expect(await snapshot(t.repo, t.ana.id)).toEqual(rows);
    expect(await t.repo.outbox.count()).toBe(ops);
  });

  it('a local edit made after the first restore survives the same file restored again', async () => {
    const t = await device();
    await restoreBackupJson(t.repo, t.text, { now: D1, confirmOverwrite: true });
    t.tick(90_000);
    await t.repo.profiles.update(t.ana.id, { name: 'Ana K.' });
    await t.repo.bodyweight.update(t.ana.id, 'bw-new', { valueKg: 73 });

    await restoreBackupJson(t.repo, t.text, { now: D2, confirmOverwrite: true });
    expect((await t.repo.profiles.get(t.ana.id))?.name, 'future-stamps.ts: the pin must not outlive the restore').toBe('Ana K.');
    expect((await t.repo.bodyweight.list(t.ana.id)).find((r) => r.id === 'bw-new')?.valueKg).toBe(73);
  });

  it('is idempotent with the parser default clock (no `now` option)', async () => {
    const t = await device();
    await restoreBackupJson(t.repo, t.text, { confirmOverwrite: true });
    const ops = await t.repo.outbox.count();
    await new Promise((r) => setTimeout(r, 10));
    const again = await restoreBackupJson(t.repo, t.text, { confirmOverwrite: true });
    expect(again.updated).toBe(0);
    expect(again.inserted).toBe(0);
    expect(await t.repo.outbox.count()).toBe(ops);
  });
});
