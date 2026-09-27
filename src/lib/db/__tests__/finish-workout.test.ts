import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { training } from '@/lib/training';
import { draft, exercise, freshRepo, template, T0 } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

const HOUR_MS = 3_600_000;

describe('finishWorkout', () => {
  it('stores the log with hand-derived totals, duration and local date', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const d = draft(
      'w1',
      p.id,
      [
        exercise('u1', 'bench', [
          { kg: 20, reps: 10, type: 'warmup' },
          { kg: 60, reps: 10 },
          { kg: 70, reps: 8 },
          { kg: 80, reps: 5, done: false },
        ]),
        { ...exercise('u2', 'pushup', [{ kg: 0, reps: 20 }]), modality: 'bodyweight' },
      ],
      { notes: 'draft note' },
    );
    const finishedAt = new Date(T0.getTime() + HOUR_MS + 30_000).toISOString();

    const { log, alreadyFinished } = await repo.finishWorkout(d, { finishedAt, rpe: 8, bodyweightKg: 81 });

    expect(alreadyFinished).toBe(false);
    // volume over done working sets: 60·10 + 70·8 + 0·20 = 600 + 560 + 0 = 1160 (warm-up 20·10 and undone 80·5 excluded)
    expect(log.totalVolumeKg).toBe(1160);
    // done working sets: 60×10, 70×8, 0×20 = 3
    expect(log.totalSets).toBe(3);
    // finished − started = 1 h 30 s = 3600 + 30 = 3630 s
    expect(log.durationSeconds).toBe(3630);
    // T0 is local noon on 2026-03-02
    expect(log.date).toBe('2026-03-02');
    expect(log.finishedAt).toBe(finishedAt);
    expect(log.modalitiesUsed).toEqual(['tytax', 'bodyweight']);
    expect(log).toMatchObject({ id: 'w1', profileId: p.id, rpe: 8, bodyweightKg: 81, notes: 'draft note' });
    expect(await repo.logs.get(p.id, 'w1')).toEqual(log);
  });

  it('first workout stores baseline PRs, prCount 0, e1rm on counting sets only', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const d = draft('w1', p.id, [
      exercise('u1', 'bench', [
        { kg: 100, reps: 5, type: 'warmup' },
        { kg: 60, reps: 10 },
        { kg: 70, reps: 8 },
        { kg: 90, reps: 5, done: false },
      ]),
    ]);

    const { log, prs } = await repo.finishWorkout(d);

    expect(prs.every((c) => c.isBaseline)).toBe(true);
    expect(log.prCount).toBe(0);
    const byType = Object.fromEntries(prs.map((c) => [c.prType, c]));
    // e1rm: 60×10 → 60·36/27 = 80; 70×8 → 70·36/29 = 86.896… → rounded 86.9 wins (warm-up and undone ignored)
    expect(byType.e1rm.value).toBe(86.9);
    // weight: heaviest done working set is 70 (the 100 warm-up and the undone 90 do not count)
    expect(byType.weight.value).toBe(70);
    expect(await repo.prs.list(p.id)).toHaveLength(2);

    const [warm, s60, s70, undone] = log.exercises[0].sets;
    expect(warm.e1rm).toBeUndefined();
    expect(undone.e1rm).toBeUndefined();
    // Brzycki 60·36/(37−10) = 80
    expect(s60.e1rm).toBeCloseTo(80, 6);
    // 70 x 36 / (37 - 8) = 86.8966 -> stored rounded to 0.01 by G1 rankableE1rm = 86.9
    expect(s70.e1rm).toBe(86.9);
    expect(log.exercises[0].sets.some((s) => s.isPR)).toBe(false);
  });

  it('a heavier second workout yields a non-baseline e1rm PR flagged on its set', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 70, reps: 8 }])]));
    tick(2 * 86_400_000);
    const second = draft('w2', p.id, [
      exercise('u2', 'bench', [
        { kg: 60, reps: 8 },
        { kg: 75, reps: 8 },
      ]),
    ]);
    const heavySetId = second.exercises[0].sets[1].id;

    const { log, prs } = await repo.finishWorkout(second);

    const e1rmPr = prs.find((c) => c.prType === 'e1rm');
    // 75·36/29 = 93.103… → 93.1 > previous 70·36/29 = 86.9
    expect(e1rmPr).toMatchObject({ isBaseline: false, value: 93.1, previousBest: 86.9, setId: heavySetId });
    // weight 75 > 70 → second non-baseline PR; prCount = 2
    expect(log.prCount).toBe(2);
    expect(log.exercises[0].sets[1].isPR).toBe(true);
    expect(log.exercises[0].sets[0].isPR).toBeUndefined();
    const best = await repo.prs.best(p.id, 'bench');
    expect(best.e1rm?.value).toBe(93.1);
    expect(best.e1rm?.workoutLogId).toBe('w2');
  });

  it('warm-up and undone sets never make PRs or totals', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'squat', [{ kg: 100, reps: 5 }])]));
    const { log, prs } = await repo.finishWorkout(
      draft('w2', p.id, [
        exercise('u2', 'squat', [
          { kg: 200, reps: 5, type: 'warmup' },
          { kg: 180, reps: 5, done: false },
          { kg: 50, reps: 5 },
        ]),
      ]),
    );
    expect(prs).toEqual([]);
    expect(log.prCount).toBe(0);
    // only 50×5 counts: 250 kg over 1 set
    expect(log.totalVolumeKg).toBe(250);
    expect(log.totalSets).toBe(1);
  });

  it('is idempotent: the same draft twice stores one log and no duplicate PRs', async () => {
    const { repo, db } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(3), { activate: true });
    const d = draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])], { programId: prog.id });

    const first = await repo.finishWorkout(d);
    const again = await repo.finishWorkout(d);

    expect(again.alreadyFinished).toBe(true);
    expect(again.prs).toEqual([]);
    expect(again.log).toEqual(first.log);
    expect(again.advancedProgram).toBeUndefined();
    expect(await repo.logs.count(p.id)).toBe(1);
    // e1rm + weight baselines from the first call only
    expect(await db.prRecords.count()).toBe(2);
    // advanced once: (0 + 1) % 3 = 1
    expect((await repo.programs.get(p.id, prog.id))?.currentSessionIndex).toBe(1);
  });

  it('advances the program rotation and wraps a 7-session program', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const prog = await repo.programs.create(p.id, template(7), { activate: true });
    const next: number[] = [];
    for (let i = 0; i < 7; i++) {
      tick(86_400_000);
      const res = await repo.finishWorkout(draft(`w${i}`, p.id, [exercise(`u${i}`, 'bench', [{ kg: 50, reps: 5 }])], { programId: prog.id }));
      expect(res.advancedProgram?.programId).toBe(prog.id);
      next.push(res.advancedProgram?.nextSessionIndex ?? -1);
    }
    // (i + 1) % 7 starting at 0: 1…6, then 7 % 7 = 0
    expect(next).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect((await repo.programs.getActive(p.id))?.currentSessionIndex).toBe(0);
  });
});
