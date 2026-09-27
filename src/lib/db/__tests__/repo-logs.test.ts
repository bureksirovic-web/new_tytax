import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { draft, exercise, expectCode, fakeSync, freshRepo, T0 } from './helpers';

const DAY_MS = 86_400_000;

function startedOn(dayOffset: number): string {
  return new Date(T0.getTime() + dayOffset * DAY_MS).toISOString();
}

async function threeLogs() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'A' });
  // T0 is local noon 2026-03-02, so the logs fall on 03-02, 03-04 and 03-06
  for (const [id, day, ex] of [['w0', 0, 'bench'], ['w2', 2, 'squat'], ['w4', 4, 'bench']] as const) {
    await t.repo.finishWorkout(draft(id, p.id, [exercise(`u-${id}`, ex, [{ kg: 50, reps: 5 }])], { startedAt: startedOn(day) }));
  }
  return { ...t, p };
}

describe('logs', () => {
  it('list is newest first, filters by inclusive date range and pages', async () => {
    const { repo, p } = await threeLogs();
    expect((await repo.logs.list(p.id)).map((l) => l.id)).toEqual(['w4', 'w2', 'w0']);
    expect((await repo.logs.list(p.id, { from: '2026-03-04' })).map((l) => l.id)).toEqual(['w4', 'w2']);
    expect((await repo.logs.list(p.id, { to: '2026-03-04' })).map((l) => l.id)).toEqual(['w2', 'w0']);
    expect((await repo.logs.list(p.id, { from: '2026-03-04', to: '2026-03-04' })).map((l) => l.id)).toEqual(['w2']);
    expect(await repo.logs.list(p.id, { from: '2026-03-06', to: '2026-03-01' })).toEqual([]);
    expect((await repo.logs.list(p.id, { offset: 1, limit: 1 })).map((l) => l.id)).toEqual(['w2']);
    expect((await repo.logs.list(p.id, { offset: 2 })).map((l) => l.id)).toEqual(['w0']);
    await expectCode(repo.logs.list(p.id, { from: '4.3.2026' }), 'VALIDATION');
    await expectCode(repo.logs.list(p.id, { to: '2026-02-30' }), 'VALIDATION');
  });

  it('same-day logs order by startedAt desc', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('early', p.id, [], { startedAt: new Date(T0.getTime() - 3_600_000).toISOString() }));
    await repo.finishWorkout(draft('late', p.id, [], { startedAt: new Date(T0.getTime() + 3_600_000).toISOString() }));
    expect((await repo.logs.list(p.id)).map((l) => l.id)).toEqual(['late', 'early']);
  });

  it('historyFor returns logs with the exercise, hides deleted unless asked, and pages', async () => {
    const { repo, p } = await threeLogs();
    expect((await repo.logs.historyFor(p.id, 'bench')).map((l) => l.id)).toEqual(['w4', 'w0']);
    expect((await repo.logs.historyFor(p.id, 'bench', { limit: 1 })).map((l) => l.id)).toEqual(['w4']);
    await repo.logs.softDelete(p.id, 'w4');
    expect((await repo.logs.historyFor(p.id, 'bench')).map((l) => l.id)).toEqual(['w0']);
    expect((await repo.logs.historyFor(p.id, 'bench', { includeDeleted: true })).map((l) => l.id)).toEqual(['w4', 'w0']);
    expect(await repo.logs.historyFor(p.id, 'deadlift')).toEqual([]);
  });

  it('update recomputes totals from exercises and ignores server-owned fields in the patch', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const { log } = await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    tick();
    const sneaky = { notes: 'edited', rpe: 7, totalVolumeKg: 99999, totalSets: 42, prCount: 9, modalitiesUsed: ['kettlebell'], createdAt: 'x', updatedAt: 'y' } as Partial<WorkoutLog>;
    const edited = await repo.logs.update(p.id, 'w1', sneaky);
    // unchanged exercises: 60×5 = 300 kg over 1 set; prCount stays 0 (baselines only)
    expect(edited).toMatchObject({ notes: 'edited', rpe: 7, totalVolumeKg: 300, totalSets: 1, prCount: 0, modalitiesUsed: ['tytax'] });
    expect(edited.createdAt).toBe(log.createdAt);
    expect(edited.updatedAt).toBe(now().toISOString());

    const more = [
      exercise('u1', 'bench', [{ kg: 60, reps: 5 }, { kg: 62.5, reps: 4 }, { kg: 40, reps: 10, type: 'warmup' }, { kg: 70, reps: 1, done: false }]),
      { ...exercise('u2', 'swing', [{ kg: 24, reps: 15 }]), modality: 'kettlebell' as const },
    ];
    const recomputed = await repo.logs.update(p.id, 'w1', { exercises: more });
    // done working sets: 60·5 + 62.5·4 + 24·15 = 300 + 250 + 360 = 910 kg over 3 sets
    expect(recomputed.totalVolumeKg).toBe(910);
    expect(recomputed.totalSets).toBe(3);
    expect(recomputed.modalitiesUsed).toEqual(['tytax', 'kettlebell']);
    expect(await repo.logs.get(p.id, 'w1')).toEqual(recomputed);
  });

  it('update validates its patch and refuses deleted or missing logs', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, []));
    const bad: Array<Partial<WorkoutLog>> = [
      { date: '2026-3-1' },
      { startedAt: 'soon' },
      { finishedAt: 'later' },
      { durationSeconds: -1 },
      { bodyweightKg: -3 },
      { rpe: 11 },
      { rpe: 0 },
      { exercises: 'none' as unknown as WorkoutLog['exercises'] },
      { exercises: [exercise('u', 'bench', [{ kg: -1, reps: 5 }])] },
      { exercises: [{ ...exercise('u', '', []) }] },
    ];
    for (const patch of bad) await expectCode(repo.logs.update(p.id, 'w1', patch), 'VALIDATION');
    await expectCode(repo.logs.update(p.id, 'ghost', { notes: 'x' }), 'NOT_FOUND');
    await repo.logs.softDelete(p.id, 'w1');
    await expectCode(repo.logs.update(p.id, 'w1', { notes: 'x' }), 'NOT_FOUND');
    await expectCode(repo.logs.restore(p.id, 'ghost'), 'NOT_FOUND');
  });

  it('softDelete and restore are idempotent and queue one op each when sync is on', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await repo.outbox.ack((await repo.outbox.peek(100)).map((o) => o.id));

    await repo.logs.softDelete(p.id, 'w1');
    await repo.logs.softDelete(p.id, 'w1');
    // 1 log + 2 PR rows tombstoned = 3 delete ops, the second call adds none
    expect((await repo.outbox.peek(100)).map((o) => `${o.table}:${o.op}`).sort()).toEqual(['pr_records:delete', 'pr_records:delete', 'workout_logs:delete']);
    await repo.outbox.ack((await repo.outbox.peek(100)).map((o) => o.id));

    await repo.logs.restore(p.id, 'w1');
    await repo.logs.restore(p.id, 'w1');
    expect((await repo.outbox.peek(100)).map((o) => `${o.table}:${o.op}`).sort()).toEqual(['pr_records:upsert', 'pr_records:upsert', 'workout_logs:upsert']);
    expect(await repo.prs.list(p.id)).toHaveLength(2);
  });
});
