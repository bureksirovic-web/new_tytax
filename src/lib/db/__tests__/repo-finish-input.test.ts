import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { WorkoutDraft } from '@/contracts/domain';
import { draft, exercise, expectCode, fakeSync, freshRepo, template, T0 } from './helpers';

describe('finishWorkout input and totals', () => {
  it('recomputes totals and PR flags server-side, ignoring anything the client put on the draft', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const ex = exercise('u1', 'bench', [
      { kg: 60, reps: 10 },
      { kg: 100, reps: 3, type: 'warmup' },
      { kg: 90, reps: 3, done: false },
      { kg: 50, reps: 12, type: 'drop' },
    ]);
    ex.sets = ex.sets.map((s) => ({ ...s, isPR: true, e1rm: 999 }));
    const sneaky = { ...draft('w1', p.id, [ex]), totalVolumeKg: 1, totalSets: 99, prCount: 7 } as WorkoutDraft;

    const { log } = await repo.finishWorkout(sneaky);

    // done non-warm-up sets: 60·10 + 50·12 = 600 + 600 = 1200 kg over 2 sets
    expect(log.totalVolumeKg).toBe(1200);
    expect(log.totalSets).toBe(2);
    // first workout: every PR is a baseline → prCount 0, no set flagged
    expect(log.prCount).toBe(0);
    expect(log.exercises[0].sets.every((s) => s.isPR === undefined)).toBe(true);
    const [s60, warm, undone, drop] = log.exercises[0].sets;
    // Brzycki 60·36/(37−10) = 80; 50·36/(37−12) = 72
    expect(s60.e1rm).toBeCloseTo(80, 6);
    expect(drop.e1rm).toBeCloseTo(72, 6);
    expect(warm.e1rm).toBeUndefined();
    expect(undone.e1rm).toBeUndefined();
  });

  it('an empty workout stores zero totals and no PRs', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const { log, prs } = await repo.finishWorkout(draft('w1', p.id, []));
    expect(log).toMatchObject({ totalVolumeKg: 0, totalSets: 0, prCount: 0, modalitiesUsed: [], durationSeconds: 0 });
    expect(prs).toEqual([]);
    expect(await repo.prs.list(p.id)).toEqual([]);
  });

  it('does not advance a program of another profile, a deleted one, or one without sessions', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const progB = await repo.programs.create(b.id, template(3));
    const deleted = await repo.programs.create(a.id, template(3));
    await repo.programs.softDelete(a.id, deleted.id);
    const empty = await repo.programs.create(a.id, template(0));
    const sets = () => [exercise('u', 'bench', [{ kg: 40, reps: 5 }])];

    const r1 = await repo.finishWorkout(draft('w1', a.id, sets(), { programId: progB.id }));
    const r2 = await repo.finishWorkout(draft('w2', a.id, sets(), { programId: deleted.id }));
    const r3 = await repo.finishWorkout(draft('w3', a.id, sets(), { programId: empty.id }));

    expect([r1, r2, r3].map((r) => r.advancedProgram)).toEqual([undefined, undefined, undefined]);
    expect((await repo.programs.get(b.id, progB.id))?.currentSessionIndex).toBe(0);
    expect((await repo.programs.get(b.id, progB.id))?.updatedAt).toBe(progB.updatedAt);
    expect(await repo.logs.count(a.id)).toBe(3);
  });

  it('queues log, PR and program ops when sync is enabled and notifies once', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(2), { activate: true });
    await repo.outbox.ack((await repo.outbox.peek(100)).map((o) => o.id));
    sync.notifyChanged.mockClear();

    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])], { programId: prog.id }));

    const tables = (await repo.outbox.peek(100)).map((o) => o.table).sort();
    // 1 log + 2 PR baselines (e1rm, weight) + 1 program advance
    expect(tables).toEqual(['pr_records', 'pr_records', 'programs', 'workout_logs']);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('rejects bad input with typed errors and writes nothing', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const ok = () => draft('w', p.id, [exercise('u', 'bench', [{ kg: 50, reps: 5 }])]);
    await expectCode(repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: -5, reps: 5 }])])), 'VALIDATION');
    await expectCode(repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 5, reps: Number.NaN }])])), 'VALIDATION');
    await expectCode(repo.finishWorkout(draft('w2', p.id, [], { startedAt: 'yesterday' })), 'VALIDATION');
    await expectCode(repo.finishWorkout({ ...ok(), id: '' }), 'VALIDATION');
    await expectCode(repo.finishWorkout({ ...ok(), sessionName: 3 as unknown as string }), 'VALIDATION');
    await expectCode(repo.finishWorkout({ ...ok(), exercises: {} as WorkoutDraft['exercises'] }), 'VALIDATION');
    await expectCode(repo.finishWorkout(null as unknown as WorkoutDraft), 'VALIDATION');
    await expectCode(repo.finishWorkout(ok(), { rpe: 0 }), 'VALIDATION');
    await expectCode(repo.finishWorkout(ok(), { rpe: 11 }), 'VALIDATION');
    await expectCode(repo.finishWorkout(ok(), { bodyweightKg: -1 }), 'VALIDATION');
    await expectCode(repo.finishWorkout(ok(), { finishedAt: 'now' }), 'VALIDATION');
    await expectCode(repo.finishWorkout(draft('w3', 'ghost', [])), 'NOT_FOUND');
    expect(await repo.logs.count(p.id, { includeDeleted: true })).toBe(0);
  });

  it('uses the debrief finishedAt, else the injected clock; a finish before the start clamps to 0 s', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    tick(45 * 60_000);
    const { log } = await repo.finishWorkout(draft('w1', p.id, []), { notes: 'debrief note' });
    // clock moved 45 min past T0 = startedAt → 2700 s
    expect(log.durationSeconds).toBe(2700);
    expect(log.notes).toBe('debrief note');
    const early = new Date(T0.getTime() - 60_000).toISOString();
    expect((await repo.finishWorkout(draft('w2', p.id, []), { finishedAt: early })).log.durationSeconds).toBe(0);
  });
});
