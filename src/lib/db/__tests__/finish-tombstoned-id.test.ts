/**
 * Refuter R1 (2026-09-27): finishWorkout with the id of a tombstoned log
 * returned `alreadyFinished: true` with the tombstone as the saved workout,
 * and the caller then discarded the draft. A deleted log is never a success:
 * it is a CONFLICT that writes nothing, so the draft is kept.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { draft, exercise, expectCode, freshRepo } from './helpers';

async function setup() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'A' });
  const d = draft('w-dead', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]);
  const first = await t.repo.finishWorkout(d);
  t.tick();
  await t.repo.logs.softDelete(p.id, d.id);
  await t.repo.outbox.ack((await t.repo.outbox.peek(100)).map((o) => o.id));
  return { ...t, p, d, first };
}

describe('finishWorkout on a tombstoned log id', () => {
  it('rejects with CONFLICT and writes nothing (the tombstone stays, no op is queued)', async () => {
    const s = await setup();
    const before = await s.db.workoutLogs.get(s.d.id);
    expect(before?.deletedAt).toBeDefined();
    await expectCode(s.repo.finishWorkout(s.d), 'CONFLICT');
    await expect(s.repo.finishWorkout(s.d)).rejects.toThrow(/was deleted/);
    expect(await s.db.workoutLogs.get(s.d.id)).toStrictEqual(before);
    expect(await s.repo.outbox.count()).toBe(0);
  });

  it('rejects a tombstone that arrived through applyRemote (deleted on another device)', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const d = draft('w-remote', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]);
    const stamp = t.now().toISOString();
    const tombstone: WorkoutLog = {
      id: d.id,
      profileId: p.id,
      sessionName: 'Deleted elsewhere',
      date: '2026-03-02',
      startedAt: stamp,
      finishedAt: stamp,
      durationSeconds: 0,
      exercises: [],
      totalVolumeKg: 0,
      totalSets: 0,
      prCount: 0,
      modalitiesUsed: [],
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: stamp,
    };
    expect((await t.repo.applyRemote('workout_logs', [{ ...tombstone }])).applied).toBe(1);
    await expectCode(t.repo.finishWorkout(d), 'CONFLICT');
    expect((await t.db.workoutLogs.get(d.id))?.sessionName).toBe('Deleted elsewhere');
    expect((await t.db.workoutLogs.get(d.id))?.deletedAt).toBe(stamp);
  });

  it('a live log with the same id is still the idempotent alreadyFinished result', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const d = draft('w-live', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]);
    const first = await t.repo.finishWorkout(d);
    const again = await t.repo.finishWorkout(d);
    expect(again.alreadyFinished).toBe(true);
    expect(again.log).toStrictEqual(first.log);
    expect(again.prs).toEqual([]);
  });
});
