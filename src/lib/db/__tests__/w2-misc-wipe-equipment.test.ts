/** Wave 2 item 7 (G4-36): device wipe and equipment "not configured" semantics. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Repository } from '@/contracts';
import { createRepository, getWipeAll, isEquipmentConfigured, TytaxDatabase } from '..';
import { draft, exercise, fakeSync, freshRepo } from './helpers';

describe('wipeAll', () => {
  it('empties every IndexedDB table (data, outbox, meta) and queues nothing', async () => {
    const t = freshRepo({ sync: fakeSync() });
    const a = await t.repo.profiles.create({ name: 'Ana' });
    await t.repo.profiles.create({ name: 'Marko' });
    await t.repo.profiles.setActive(a.id);
    await t.repo.finishWorkout(draft('w1', a.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await t.repo.bodyweight.add(a.id, { date: '2026-03-02', valueKg: 70 });
    expect(await t.repo.outbox.count()).toBeGreaterThan(0);
    expect(await t.db.meta.count()).toBe(1);

    await getWipeAll(t.repo)();

    for (const table of t.db.tables) expect(await table.count(), table.name).toBe(0);
    expect(await t.repo.profiles.getActiveId()).toBeNull();
    expect(await t.repo.profiles.list()).toEqual([]);
    expect(await t.repo.outbox.count()).toBe(0);
  });

  it('leaves the repository usable and is a no-op on an empty device', async () => {
    const t = freshRepo();
    await getWipeAll(t.repo)();
    const p = await t.repo.profiles.create({ name: 'Iva' });
    expect(await t.repo.profiles.list()).toEqual([p]);
  });

  it('never touches localStorage', async () => {
    const t = freshRepo();
    window.localStorage.setItem('tytax-draft', 'kept');
    await t.repo.profiles.create({ name: 'Ana' });
    await getWipeAll(t.repo)();
    expect(window.localStorage.getItem('tytax-draft')).toBe('kept');
    window.localStorage.removeItem('tytax-draft');
  });

  it('getWipeAll throws NOT_IMPLEMENTED for a contract-only repository', () => {
    const { wipeAll: _drop, ...bare } = createRepository({ db: new TytaxDatabase('w2-wipe-type') });
    expect(typeof _drop).toBe('function');
    const contractOnly: Repository = bare;
    expect(() => getWipeAll(contractOnly)).toThrowError(/not available/);
  });
});

describe('isEquipmentConfigured', () => {
  const empty = { stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [] };

  it('is false for the default inventory, null and undefined', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'Ana' });
    expect(isEquipmentConfigured(await t.repo.equipment.get(p.id))).toBe(false);
    expect(isEquipmentConfigured(empty)).toBe(false);
    expect(isEquipmentConfigured(null)).toBe(false);
    expect(isEquipmentConfigured(undefined)).toBe(false);
  });

  it('is true as soon as any one of the four lists has an entry', () => {
    expect(isEquipmentConfigured({ ...empty, stationIds: ['smith'] })).toBe(true);
    expect(isEquipmentConfigured({ ...empty, attachmentIds: ['rope'] })).toBe(true);
    expect(isEquipmentConfigured({ ...empty, kettlebellsKg: [16] })).toBe(true);
    expect(isEquipmentConfigured({ ...empty, bodyweightGear: ['none'] })).toBe(true);
  });

  it('follows a saved inventory', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'Ana' });
    expect(isEquipmentConfigured(await t.repo.equipment.save(p.id, { kettlebellsKg: [12] }))).toBe(true);
    expect(isEquipmentConfigured(await t.repo.equipment.save(p.id, { kettlebellsKg: [] }))).toBe(false);
  });
});
