/**
 * logs.update keeps `WorkoutLog.date` the local calendar day of `startedAt`
 * (domain.ts), derived as finishWorkout derives it: a new startedAt moves the
 * day, a contradicting date is refused, and PR chronology (chrono compares
 * `date` first) follows the edit.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { localDay } from '@/contracts/fixtures';
import { draft, exercise, expectCode, freshRepo, type TestRepo } from './helpers';

const at = (day: number) => new Date(2026, 2, day, 10, 0, 0, 0).toISOString();

async function build(): Promise<{ t: TestRepo; pid: string }> {
  const t = freshRepo();
  const pid = (await t.repo.profiles.create({ name: 'P' })).id;
  await t.repo.finishWorkout(draft('L1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }])], { startedAt: at(5) }));
  await t.repo.finishWorkout(draft('L2', pid, [exercise('u2', 'bench', [{ kg: 110, reps: 5 }])], { startedAt: at(6) }));
  return { t, pid };
}

describe('logs.update of startedAt', () => {
  it('the stored day still matches the stored startedAt', async () => {
    const { t, pid } = await build();
    await t.repo.logs.update(pid, 'L2', { startedAt: at(4) }); // the session really happened on 2026-03-04
    const log = await t.repo.logs.get(pid, 'L2');
    expect(log?.date).toBe(localDay(new Date(at(4))));
  });

  it('a day-range query finds the session on the day it started', async () => {
    const { t, pid } = await build();
    await t.repo.logs.update(pid, 'L2', { startedAt: at(4) });
    const on4 = await t.repo.logs.list(pid, { from: '2026-03-04', to: '2026-03-04' });
    const on6 = await t.repo.logs.list(pid, { from: '2026-03-06', to: '2026-03-06' });
    expect({ on4: on4.map((l) => l.id), on6: on6.map((l) => l.id) }).toEqual({ on4: ['L2'], on6: [] });
  });

  it('moving a session in front of an older one moves the PR credit with it', async () => {
    const x = await build(); // edited by startedAt only
    const y = await build(); // edited by startedAt + the day it implies
    await x.t.repo.logs.update(x.pid, 'L2', { startedAt: at(4) });
    await y.t.repo.logs.update(y.pid, 'L2', { startedAt: at(4), date: '2026-03-04' });
    const state = async (r: TestRepo, pid: string) => ({
      L1: (await r.repo.logs.get(pid, 'L1'))?.prCount,
      L2: (await r.repo.logs.get(pid, 'L2'))?.prCount,
    });
    const startedAtOnly = await state(x.t, x.pid);
    const dateToo = await state(y.t, y.pid);
    // Chronologically L2 (2026-03-04, 110 kg) is the first bench session: baseline, 0 PRs,
    // and L1 (03-05, 100 kg) sets none either (100 < 110). Both edits describe the same session.
    expect({ startedAtOnly, dateToo }).toEqual({ startedAtOnly: dateToo, dateToo: { L1: 0, L2: 0 } });
  });

  it('a date contradicting startedAt is refused, a date-only edit away from startedAt too', async () => {
    const { t, pid } = await build();
    await expectCode(t.repo.logs.update(pid, 'L2', { startedAt: at(4), date: '2026-03-05' }), 'VALIDATION');
    await expectCode(t.repo.logs.update(pid, 'L2', { date: '2026-03-01' }), 'VALIDATION');
    const log = await t.repo.logs.get(pid, 'L2');
    expect({ date: log?.date, startedAt: log?.startedAt }).toEqual({ date: localDay(new Date(at(6))), startedAt: at(6) });
  });
});
