import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import { isRepoError, type BackupV3 } from '@/contracts/repo';
import { exercise, draft, fakeSync, freshRepo, template, T0 } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(isRepoError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

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

describe('profile isolation and removal', () => {
  async function seedTwo() {
    const t = freshRepo();
    const { repo } = t;
    const a = await repo.profiles.create({ name: 'A' });
    t.tick();
    const b = await repo.profiles.create({ name: 'B' });
    for (const p of [a, b]) {
      await repo.finishWorkout(draft(`log-${p.name}`, p.id, [exercise(`u-${p.name}`, 'bench', [{ kg: 50, reps: 5 }])]));
      await repo.programs.create(p.id, template(3), { activate: true });
      await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
      await repo.notes.set(p.id, 'bench', 'elbows in');
      await repo.arsenal.add(p.id, 'bench');
      await repo.equipment.save(p.id, { kettlebellsKg: [16] });
    }
    return { ...t, a, b };
  }

  it("A's records are invisible from B", async () => {
    const { repo, a, b } = await seedTwo();
    const logsB = await repo.logs.list(b.id);
    expect(logsB.map((l) => l.id)).toEqual(['log-B']);
    expect(await repo.logs.get(b.id, 'log-A')).toBeUndefined();
    await expectCode(repo.logs.update(b.id, 'log-A', { notes: 'x' }), 'NOT_FOUND');
    await expectCode(repo.logs.softDelete(b.id, 'log-A'), 'NOT_FOUND');
    const progA = (await repo.programs.list(a.id))[0];
    expect(await repo.programs.get(b.id, progA.id)).toBeUndefined();
    await expectCode(repo.programs.setActive(b.id, progA.id), 'NOT_FOUND');
    expect((await repo.prs.list(b.id)).every((r) => r.profileId === b.id)).toBe(true);
  });

  it('remove wipes every row of that profile only, then re-points the active id', async () => {
    const { repo, db, a, b } = await seedTwo();
    await repo.profiles.setActive(a.id);
    const tables = [db.workoutLogs, db.programs, db.prRecords, db.bodyweightEntries, db.exerciseNotes, db.arsenal, db.equipment];
    const before = await Promise.all(tables.map((t) => t.where('profileId').equals(b.id).count()));

    await repo.profiles.remove(a.id);

    for (const t of tables) expect(await t.where('profileId').equals(a.id).count()).toBe(0);
    expect(await db.profiles.get(a.id)).toBeUndefined();
    expect(await Promise.all(tables.map((t) => t.where('profileId').equals(b.id).count()))).toEqual(before);
    expect(await repo.profiles.getActiveId()).toBe(b.id);

    await repo.profiles.remove(b.id);
    expect(await repo.profiles.getActiveId()).toBeNull();
    await expectCode(repo.profiles.remove(b.id), 'NOT_FOUND');
  });

  it('with sync enabled, remove tombstones rows and queues delete ops', async () => {
    const sync = fakeSync();
    const { repo, db } = freshRepo({ sync });
    const a = await repo.profiles.create({ name: 'A' });
    await repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });
    await repo.outbox.ack((await repo.outbox.peek(100)).map((o) => o.id));
    await repo.profiles.remove(a.id);
    const tomb = await db.bodyweightEntries.where('profileId').equals(a.id).toArray();
    expect(tomb).toHaveLength(1);
    expect(tomb[0].deletedAt).toBe(T0.toISOString());
    expect((await db.profiles.get(a.id))?.deletedAt).toBe(T0.toISOString());
    const ops = await repo.outbox.peek(10);
    expect(ops.map((o) => [o.table, o.op])).toEqual([
      ['bodyweight_entries', 'delete'],
      ['profiles', 'delete'],
    ]);
    expect(await repo.profiles.list()).toEqual([]);
  });
});

describe('soft delete', () => {
  it('hides a deleted log unless includeDeleted, and restore brings it (and its PRs) back', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.prs.list(p.id)).toHaveLength(2);

    tick();
    await repo.logs.softDelete(p.id, 'w1');
    expect(await repo.logs.list(p.id)).toEqual([]);
    expect(await repo.logs.get(p.id, 'w1')).toBeUndefined();
    expect((await repo.logs.get(p.id, 'w1', { includeDeleted: true }))?.deletedAt).toBeDefined();
    expect(await repo.logs.count(p.id)).toBe(0);
    expect(await repo.logs.count(p.id, { includeDeleted: true })).toBe(1);
    expect(await repo.prs.list(p.id)).toEqual([]);

    tick();
    await repo.logs.restore(p.id, 'w1');
    const back = await repo.logs.get(p.id, 'w1');
    expect(back?.deletedAt).toBeUndefined();
    expect(await repo.logs.count(p.id)).toBe(1);
    expect(await repo.prs.list(p.id)).toHaveLength(2);
  });

  it('bodyweight entries: validation, date range and soft delete', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await expectCode(repo.bodyweight.add(p.id, { date: '2026-02-30', valueKg: 70 }), 'VALIDATION');
    await expectCode(repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: -1 }), 'VALIDATION');
    const e1 = await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await repo.bodyweight.add(p.id, { date: '2026-03-05', valueKg: 71 });
    expect((await repo.bodyweight.list(p.id)).map((e) => e.date)).toEqual(['2026-03-05', '2026-03-01']);
    expect((await repo.bodyweight.list(p.id, { from: '2026-03-02' })).map((e) => e.valueKg)).toEqual([71]);
    await repo.bodyweight.softDelete(p.id, e1.id);
    expect(await repo.bodyweight.list(p.id)).toHaveLength(1);
    expect(await repo.bodyweight.list(p.id, { includeDeleted: true })).toHaveLength(2);
    await expectCode(repo.bodyweight.update(p.id, e1.id, { valueKg: 69 }), 'NOT_FOUND');
  });
});

describe('notes, arsenal, equipment, prs.best', () => {
  it('notes: upsert, empty string soft-deletes, set again revives the same row', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const n1 = await repo.notes.set(p.id, 'bench', 'tuck elbows');
    expect((await repo.notes.get(p.id, 'bench'))?.content).toBe('tuck elbows');
    expect(await repo.notes.set(p.id, 'bench', '')).toBeUndefined();
    expect(await repo.notes.get(p.id, 'bench')).toBeUndefined();
    const n2 = await repo.notes.set(p.id, 'bench', 'pause at chest');
    expect(n2?.id).toBe(n1?.id);
    expect(await repo.notes.list(p.id)).toHaveLength(1);
  });

  it('arsenal: add is idempotent, remove soft-deletes, has reflects it', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const e1 = await repo.arsenal.add(p.id, 'squat');
    const e2 = await repo.arsenal.add(p.id, 'squat');
    expect(e2.id).toBe(e1.id);
    expect(await repo.arsenal.has(p.id, 'squat')).toBe(true);
    await repo.arsenal.remove(p.id, 'squat');
    expect(await repo.arsenal.has(p.id, 'squat')).toBe(false);
    expect(await repo.arsenal.list(p.id)).toEqual([]);
    await repo.arsenal.remove(p.id, 'squat');
    expect((await repo.arsenal.add(p.id, 'squat')).id).toBe(e1.id);
  });

  it('equipment: default when missing, save merges and copies arrays', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const empty = await repo.equipment.get(p.id);
    expect(empty).toMatchObject({ id: p.id, profileId: p.id, stationIds: [], kettlebellsKg: [] });
    const kbs = [16, 24];
    const saved = await repo.equipment.save(p.id, { kettlebellsKg: kbs, stationIds: ['SMITH'] });
    kbs.push(32);
    expect(saved.kettlebellsKg).toEqual([16, 24]);
    const merged = await repo.equipment.save(p.id, { attachmentIds: ['rope'] });
    expect(merged).toMatchObject({ stationIds: ['SMITH'], attachmentIds: ['rope'], kettlebellsKg: [16, 24] });
    await expectCode(repo.equipment.save(p.id, { kettlebellsKg: [-4] }), 'VALIDATION');
  });

  it('prs.best returns the max-value live record per PR type', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 10 }])]));
    tick(86_400_000);
    await repo.finishWorkout(draft('w2', p.id, [exercise('u2', 'bench', [{ kg: 70, reps: 3 }])], { startedAt: new Date(T0.getTime() + 86_400_000).toISOString() }));
    const best = await repo.prs.best(p.id, 'bench');
    // weight: max(60, 70) = 70, set by w2
    expect(best.weight?.value).toBe(70);
    expect(best.weight?.workoutLogId).toBe('w2');
    // e1rm: w1 60×10 → 60·36/27 = 80; w2 70×3 → 70·36/34 = 74.12, not a PR → best stays 80 from w1
    expect(best.e1rm?.value).toBe(80);
    expect(best.e1rm?.workoutLogId).toBe('w1');
  });
});

describe('programs', () => {
  it('create gives fresh ids, keeps presetId, and activate sets activeProgramId', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(3, { currentSessionIndex: 2 }), { activate: true });
    expect(prog.presetId).toBe('preset-test');
    expect(prog.currentSessionIndex).toBe(2);
    expect(prog.sessions.every((s) => s.programId === prog.id)).toBe(true);
    expect(new Set(prog.sessions.map((s) => s.id)).size).toBe(3);
    expect(prog.sessions.some((s) => s.id.startsWith('tpl-'))).toBe(false);
    expect((await repo.profiles.get(p.id))?.activeProgramId).toBe(prog.id);
    expect((await repo.programs.getActive(p.id))?.id).toBe(prog.id);

    await repo.programs.softDelete(p.id, prog.id);
    expect((await repo.profiles.get(p.id))?.activeProgramId).toBeNull();
    expect(await repo.programs.getActive(p.id)).toBeUndefined();
  });

  it('advance wraps around a 7-session rotation', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(7));
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) seen.push((await repo.programs.advance(p.id, prog.id)).currentSessionIndex);
    // (i + 1) % 7 from 0: 1, 2, 3, 4, 5, 6, then 7 % 7 = 0
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 0]);
    await expectCode(repo.programs.advance(p.id, 'nope'), 'NOT_FOUND');
    await expectCode(repo.programs.update(p.id, prog.id, { currentSessionIndex: 7 }), 'VALIDATION');
  });
});

describe('sync outbox', () => {
  it('queues nothing without an enabled adapter', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.outbox.count()).toBe(0);
  });

  it('queues ops in the same transaction and notifies after commit when enabled', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    const ops = await repo.outbox.peek(10);
    expect(ops).toEqual([
      { id: expect.any(String), table: 'profiles', op: 'upsert', recordId: p.id, profileId: p.id, createdAt: T0.toISOString(), retryCount: 0 },
    ]);

    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(sync.notifyChanged).toHaveBeenCalledTimes(2);
    // 1 profile + 1 log + 2 PR records (e1rm, weight baselines) = 4
    expect(await repo.outbox.count()).toBe(4);

    await repo.outbox.fail(ops[0].id, 'network down');
    const failed = (await repo.outbox.peek(1))[0];
    expect(failed.retryCount).toBe(1);
    expect(failed.lastError).toBe('network down');
    await repo.outbox.ack([ops[0].id]);
    expect(await repo.outbox.count()).toBe(3);
  });

  it('transaction(): repo calls inside join it; one notification after commit; a throw rolls all back', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    await repo.transaction(async () => {
      await repo.profiles.create({ name: 'A' });
      await repo.profiles.create({ name: 'B' });
      expect(sync.notifyChanged).not.toHaveBeenCalled();
    });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    expect(await repo.profiles.list()).toHaveLength(2);

    await expect(
      repo.transaction(async () => {
        await repo.profiles.create({ name: 'C' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await repo.profiles.list()).toHaveLength(2);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });
});

describe('applyRemote (last-write-wins)', () => {
  it('skips older remote rows, applies newer and unknown ones, never queues', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'Local' });
    const queued = await repo.outbox.count();
    const older = { ...p, name: 'Older', updatedAt: new Date(T0.getTime() - 60_000).toISOString() };
    const newer = { ...p, name: 'Newer', updatedAt: new Date(T0.getTime() + 60_000).toISOString() };
    const fresh = { ...p, id: 'remote-2', name: 'Remote', updatedAt: T0.toISOString() };

    expect(await repo.applyRemote('profiles', [older])).toEqual({ applied: 0, skipped: 1 });
    expect((await repo.profiles.get(p.id))?.name).toBe('Local');
    expect(await repo.applyRemote('profiles', [newer, fresh, { name: 'no id' }])).toEqual({ applied: 2, skipped: 1 });
    expect((await repo.profiles.get(p.id))?.name).toBe('Newer');
    expect((await repo.profiles.get('remote-2'))?.name).toBe('Remote');
    expect(await repo.outbox.count()).toBe(queued);
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
    expect(await dst.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 6 });
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

describe('watch and resetAll', () => {
  it('watch re-runs the query on change and stops after unsubscribe', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const seen: number[] = [];
    const unsubscribe = repo.watch(() => repo.logs.count(p.id), (n) => seen.push(n));
    await vi.waitFor(() => expect(seen).toEqual([0]));
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await vi.waitFor(() => expect(seen).toEqual([0, 1]));
    unsubscribe();
    await repo.finishWorkout(draft('w2', p.id, [exercise('u2', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.logs.count(p.id)).toBe(2);
    expect(seen).toEqual([0, 1]);
  });

  it('watch tracks reads made after several awaits (meta → profile)', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.ensureActive('Me');
    const names: Array<string | null> = [];
    const unsubscribe = repo.watch(
      async () => {
        const id = await repo.profiles.getActiveId();
        const profile = id ? await repo.profiles.get(id) : undefined;
        const logs = profile ? await repo.logs.count(profile.id) : 0;
        return profile ? `${profile.name}:${logs}` : null;
      },
      (v) => names.push(v),
    );
    await vi.waitFor(() => expect(names).toEqual(['Me:0']));
    await repo.profiles.update(p.id, { name: 'Ana' });
    await vi.waitFor(() => expect(names).toEqual(['Me:0', 'Ana:0']));
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await vi.waitFor(() => expect(names).toEqual(['Me:0', 'Ana:0', 'Ana:1']));
    unsubscribe();
  });

  it('resetAll wipes every table', async () => {
    const { repo, db } = freshRepo({ sync: fakeSync() });
    const p = await repo.profiles.ensureActive('Me');
    await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await repo.resetAll();
    const counts = await Promise.all(db.tables.map((t) => t.count()));
    expect(counts.every((c) => c === 0)).toBe(true);
    expect(await repo.profiles.getActiveId()).toBeNull();
  });
});
