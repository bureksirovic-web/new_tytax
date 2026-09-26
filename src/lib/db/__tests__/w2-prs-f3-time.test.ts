/**
 * Wave 2 G2 items 3 (F3: e1RM only up to E1RM_MAX_REPS = 12) and 4 (time
 * sets: durationSeconds persisted and validated; excluded from kg volume,
 * e1RM and PRs, still counted in totalSets when done and working).
 *
 * Brzycki e1RM = kg x 36 / (37 - reps), PR values rounded to 0.01 kg.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { SessionExercise } from '@/contracts/domain';
import { computeTotals } from '../repo/logs';
import { draft, exercise, expectCode, freshRepo, type SetSpec, type TestRepo } from './helpers';

const DAY = 86_400_000;

/** `exercise` plus `durationSeconds` on each set whose seconds entry is a number. */
function timed(uid: string, id: string, sets: Array<SetSpec & { sec?: number }>): SessionExercise {
  const ex = exercise(uid, id, sets);
  return { ...ex, sets: ex.sets.map((s, i) => (sets[i].sec === undefined ? s : { ...s, durationSeconds: sets[i].sec })) };
}

async function finish(t: TestRepo, id: string, profileId: string, exercises: SessionExercise[]) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, profileId, exercises, { startedAt: t.now().toISOString() }));
}

async function profile() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'A' });
  return { t, pid: p.id };
}

describe('F3: e1RM only for reps <= 12', () => {
  it('a 15-rep set stores no e1rm and makes no e1rm row; weight still baselines', async () => {
    const { t, pid } = await profile();
    const r = await finish(t, 'w1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 15 }])]);
    // Uncapped it would be 100 x 36 / 22 = 163.64; capped: none.
    expect(r.log.exercises[0].sets[0].e1rm).toBeUndefined();
    expect(r.prs.map((c) => `${c.prType}:${c.value}:${c.isBaseline}`)).toEqual(['weight:100:true']);
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.e1rm, best.weight?.value]).toEqual([undefined, 100]);
  });

  it('12 reps is the last rankable count: 100x12 -> e1rm 144', async () => {
    const { t, pid } = await profile();
    const r = await finish(t, 'w1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 12 }])]);
    // 100 x 36 / 25 = 144
    expect(r.log.exercises[0].sets[0].e1rm).toBe(144);
    expect((await t.repo.prs.best(pid, 'bench')).e1rm?.value).toBe(144);
  });

  it('the e1rm PR goes to the best capped set, not a higher high-rep estimate', async () => {
    const { t, pid } = await profile();
    await finish(t, 'w1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }])]); // e1rm 112.5, weight 100
    // 90x20 would be 90 x 36 / 17 = 190.59 (not rankable); 100x6 = 3600 / 31 = 116.129 -> 116.13 > 112.5.
    // weight: max 100, not > 100 -> no weight PR. prCount 1.
    const r = await finish(t, 'w2', pid, [exercise('u2', 'bench', [{ kg: 90, reps: 20 }, { kg: 100, reps: 6 }])]);
    const [high, six] = r.log.exercises[0].sets;
    expect(r.prs.map((c) => `${c.prType}:${c.value}:${c.reps}`)).toEqual(['e1rm:116.13:6']);
    expect(r.log.prCount).toBe(1);
    expect([high.e1rm, high.isPR]).toEqual([undefined, undefined]);
    expect(six.e1rm).toBeCloseTo(3600 / 31, 9);
    expect(six.isPR).toBe(true);
  });

  it('logs.update applies the cap too: editing 8 reps to 14 drops e1rm and its row', async () => {
    const { t, pid } = await profile();
    const r = await finish(t, 'w1', pid, [exercise('u1', 'bench', [{ kg: 80, reps: 8 }])]);
    const [ex] = r.log.exercises;
    t.tick();
    const edited = await t.repo.logs.update(pid, 'w1', { exercises: [{ ...ex, sets: ex.sets.map((s) => ({ ...s, reps: 14 })) }] });
    expect(edited.exercises[0].sets[0].e1rm).toBeUndefined();
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.e1rm, best.weight?.value]).toEqual([undefined, 80]);
  });
});

describe('time sets', () => {
  it('computeTotals: time sets add no kg volume but count as sets when done and working', () => {
    // bench 100x5 = 500; carry 40 kg x 1, 90 s: excluded from volume; plank 60 s: counted;
    // warm-up plank: not counted; undone bench 100x5: not counted. -> 500 kg, 3 sets.
    const totals = computeTotals([
      exercise('u1', 'bench', [{ kg: 100, reps: 5 }, { kg: 100, reps: 5, done: false }]),
      timed('u2', 'carry', [{ kg: 40, reps: 1, sec: 90 }]),
      timed('u3', 'plank', [{ kg: 0, reps: 0, sec: 60 }, { kg: 0, reps: 0, sec: 30, type: 'warmup' }]),
    ]);
    expect([totals.totalVolumeKg, totals.totalSets]).toEqual([500, 3]);
  });

  it('finishWorkout persists durationSeconds; time sets get no e1rm, isPR or PR rows', async () => {
    const { t, pid } = await profile();
    const r = await finish(t, 'w1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }]), timed('u2', 'carry', [{ kg: 40, reps: 1, sec: 90 }])]);
    const carry = r.log.exercises[1].sets[0];
    expect([carry.durationSeconds, carry.e1rm, carry.isPR]).toEqual([90, undefined, undefined]);
    expect([r.log.totalVolumeKg, r.log.totalSets]).toEqual([500, 2]);
    // Heavier carry later: still no PR (time sets never rank).
    const r2 = await finish(t, 'w2', pid, [timed('u3', 'carry', [{ kg: 60, reps: 1, sec: 90 }])]);
    expect([r2.prs, r2.log.prCount, r2.log.totalVolumeKg, r2.log.totalSets]).toEqual([[], 0, 0, 1]);
    expect(await t.repo.prs.best(pid, 'carry')).toEqual({});
  });

  it('logs.update persists a new duration and re-derives totals', async () => {
    const { t, pid } = await profile();
    const r = await finish(t, 'w1', pid, [timed('u1', 'plank', [{ kg: 0, reps: 0, sec: 60 }])]);
    const [ex] = r.log.exercises;
    t.tick();
    const edited = await t.repo.logs.update(pid, 'w1', { exercises: [{ ...ex, sets: ex.sets.map((s) => ({ ...s, durationSeconds: 75 })) }] });
    expect(edited.exercises[0].sets[0].durationSeconds).toBe(75);
    expect((await t.repo.logs.get(pid, 'w1'))?.exercises[0].sets[0].durationSeconds).toBe(75);
    expect([edited.totalVolumeKg, edited.totalSets, edited.prCount]).toEqual([0, 1, 0]);
  });

  it('durationSeconds must be an integer 0..86400 on finish and on update', async () => {
    const { t, pid } = await profile();
    for (const [i, sec] of [-1, 1.5, 86_401, Number.NaN].entries()) {
      await expectCode(finish(t, `bad-${i}`, pid, [timed(`b${i}`, 'plank', [{ kg: 0, reps: 0, sec }])]), 'VALIDATION');
    }
    const ok = await finish(t, 'edge', pid, [timed('e', 'plank', [{ kg: 0, reps: 0, sec: 0 }, { kg: 0, reps: 0, sec: 86_400 }])]);
    expect(ok.log.exercises[0].sets.map((s) => s.durationSeconds)).toEqual([0, 86_400]);
    const [ex] = ok.log.exercises;
    await expectCode(t.repo.logs.update(pid, 'edge', { exercises: [{ ...ex, sets: ex.sets.map((s) => ({ ...s, durationSeconds: -5 })) }] }), 'VALIDATION');
    expect(await t.repo.logs.count(pid)).toBe(1);
  });
});
