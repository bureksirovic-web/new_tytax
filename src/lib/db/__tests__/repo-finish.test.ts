import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Dexie from 'dexie';
import type { WorkoutDraft } from '@/contracts/domain';
import { training } from '@/lib/training';
import { createRepository } from '../repository';
import { draft, exercise, expectCode, fakeSync, freshRepo, template, type FakeSync, type TestRepo } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup(sync: FakeSync = fakeSync()) {
  const t: TestRepo = freshRepo({ sync });
  const p = await t.repo.profiles.create({ name: 'A' });
  const prog = await t.repo.programs.create(p.id, template(3), { activate: true });
  await t.repo.outbox.ack((await t.repo.outbox.peek(100)).map((o) => o.id));
  sync.notifyChanged.mockClear();
  const d: WorkoutDraft = draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])], { programId: prog.id });
  return { ...t, sync, p, prog, d };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** Asserts the failed finish left no trace: no log, PR, rotation advance, outbox row or notification. */
async function expectNothingWritten(s: Setup): Promise<void> {
  expect(await s.db.workoutLogs.count()).toBe(0);
  expect(await s.db.prRecords.count()).toBe(0);
  expect((await s.repo.programs.get(s.p.id, s.prog.id))?.currentSessionIndex).toBe(0);
  expect(await s.db.syncQueue.count()).toBe(0);
  expect(s.sync.notifyChanged).not.toHaveBeenCalled();
}

describe('finishWorkout atomicity', () => {
  it('a detectPRs failure writes nothing', async () => {
    const s = await setup();
    vi.spyOn(training, 'detectPRs').mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(s.repo.finishWorkout(s.d)).rejects.toThrow('boom');
    await expectNothingWritten(s);
  });

  it('a quota error on the PR write rolls back the log and surfaces as STORAGE', async () => {
    const s = await setup();
    vi.spyOn(s.db.prRecords, 'bulkAdd').mockRejectedValue(new Dexie.QuotaExceededError('disk full'));
    await expectCode(s.repo.finishWorkout(s.d), 'STORAGE');
    await expectNothingWritten(s);
  });

  it('an outbox write failure after the log and PRs were queued rolls everything back', async () => {
    const s = await setup();
    const add = s.db.syncQueue.add.bind(s.db.syncQueue);
    const bulkAdd = vi.spyOn(s.db.syncQueue, 'bulkAdd');
    let calls = 0;
    vi.spyOn(s.db.syncQueue, 'add').mockImplementation((row) => {
      calls += 1;
      // add: 1 = log, 2 = program advance; the 2 PRs go in one bulkAdd between them.
      if (calls === 2) throw new Error('outbox broke');
      return add(row);
    });
    await expect(s.repo.finishWorkout(s.d)).rejects.toThrow('outbox broke');
    expect(calls).toBe(2);
    expect(bulkAdd).toHaveBeenCalledTimes(1);
    expect(bulkAdd.mock.calls[0][0]).toHaveLength(2);
    await expectNothingWritten(s);
  });

  it('a sync adapter that throws mid-transaction writes nothing', async () => {
    const base = fakeSync();
    let armed = false;
    let reads = 0;
    const flaky: FakeSync = {
      ...base,
      get enabled() {
        if (armed && ++reads === 3) throw new Error('adapter crashed');
        return true;
      },
    };
    const s = await setup(flaky);
    armed = true;
    // reads 1–2 queue the log and the first PR; read 3 (second PR) throws
    await expect(s.repo.finishWorkout(s.d)).rejects.toThrow('adapter crashed');
    expect(reads).toBe(3);
    await expectNothingWritten(s);
  });

  it('a failure on the rotation write rolls back the log and PRs', async () => {
    const s = await setup();
    vi.spyOn(s.db.programs, 'put').mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(s.repo.finishWorkout(s.d)).rejects.toThrow('disk full');
    vi.restoreAllMocks();
    await expectNothingWritten(s);
  });
});

describe('finishWorkout idempotency and sync', () => {
  it('the same draft twice (even from a new repository instance) writes once', async () => {
    const s = await setup();
    const first = await s.repo.finishWorkout(s.d);
    const queued = await s.repo.outbox.count();
    const again = await s.repo.finishWorkout(s.d);
    const restarted = createRepository({ db: s.db, sync: s.sync, now: s.now });
    const third = await restarted.finishWorkout(s.d);

    for (const r of [again, third]) {
      expect(r).toEqual({ log: first.log, prs: [], alreadyFinished: true });
    }
    expect(first.alreadyFinished).toBe(false);
    expect(first.advancedProgram).toEqual({ programId: s.prog.id, nextSessionIndex: 1 });
    expect(await s.db.workoutLogs.count()).toBe(1);
    expect(await s.db.prRecords.count()).toBe(2);
    expect((await s.repo.programs.get(s.p.id, s.prog.id))?.currentSessionIndex).toBe(1);
    // 1 log + 2 PRs + 1 program = 4 ops, none added by the repeats
    expect(queued).toBe(4);
    expect(await s.repo.outbox.count()).toBe(4);
    expect(s.sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('a draft id already used by another profile is CONFLICT and leaks nothing', async () => {
    const s = await setup();
    await s.repo.finishWorkout(s.d);
    const other = await s.repo.profiles.create({ name: 'B' });
    await expectCode(s.repo.finishWorkout({ ...s.d, profileId: other.id }), 'CONFLICT');
    expect(await s.repo.logs.count(other.id)).toBe(0);
    expect(await s.repo.prs.list(other.id)).toEqual([]);
  });

  it('notifies only after the commit, outside any transaction', async () => {
    const s = await setup();
    const seen: Array<{ inTx: boolean; logged: Promise<unknown> }> = [];
    s.sync.notifyChanged.mockImplementation(() => {
      seen.push({ inTx: Dexie.currentTransaction !== null, logged: s.db.workoutLogs.get('w1') });
    });
    await s.repo.finishWorkout(s.d);
    expect(seen).toHaveLength(1);
    expect(seen[0].inTx).toBe(false);
    expect(await seen[0].logged).toBeDefined();
  });

  it('inside repo.transaction the notification waits for the outer commit; a rollback sends none', async () => {
    const s = await setup();
    await expect(
      s.repo.transaction(async () => {
        await s.repo.finishWorkout(s.d);
        throw new Error('user cancelled');
      }),
    ).rejects.toThrow('user cancelled');
    await expectNothingWritten(s);
    await s.repo.transaction(async () => {
      await s.repo.finishWorkout(s.d);
      expect(s.sync.notifyChanged).not.toHaveBeenCalled();
    });
    expect(s.sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('queues nothing and never notifies when the adapter is disabled', async () => {
    const s = await setup(fakeSync(false));
    await s.repo.finishWorkout(s.d);
    expect(await s.repo.outbox.count()).toBe(0);
    expect(s.sync.notifyChanged).not.toHaveBeenCalled();
    expect(await s.repo.logs.count(s.p.id)).toBe(1);
  });
});
