/** importLegacy into an existing profile: chronological PR recompute and active program rules. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { PRRecord } from '@/contracts';
import { draft, exercise, freshRepo, T0, template } from '@/lib/db/__tests__/helpers';
import { importLegacy } from '..';
import { MULTI_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';
import { syntheticResolver } from '../service/__fixtures__/testing';

const TEXT = loadFixtureText(MULTI_USER_DUMP.file);
const STAMP = '2026-09-26T08:00:00.000Z';
const DAY = 86_400_000;

async function seeded() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'Existing' });
  // d1 (2026-03-02): bench 50x5 -> baselines. d2 (+1 day): bench 100x5 -> real PRs.
  await t.repo.finishWorkout(draft('d1', p.id, [exercise('u1', 't-bench', [{ kg: 50, reps: 5 }])]));
  t.tick(DAY);
  const d2Start = new Date(T0.getTime() + DAY).toISOString();
  await t.repo.finishWorkout(draft('d2', p.id, [exercise('u2', 't-bench', [{ kg: 100, reps: 5 }])], { startedAt: d2Start }));
  return { ...t, profileId: p.id };
}

function importAna(t: Awaited<ReturnType<typeof seeded>>) {
  return importLegacy(t.repo, TEXT, {
    users: [{ username: 'Ana', target: { profileId: t.profileId } }],
    resolver: syntheticResolver(),
    now: () => STAMP,
  });
}

const live = (rows: PRRecord[], logId: string) => rows.filter((r) => r.workoutLogId === logId && !r.deletedAt);

describe('legacy-import service: PR recompute over imported + existing history', () => {
  it('older imported logs become the baseline; later records are kept or soft-deleted', async () => {
    const t = await seeded();
    const result = await importAna(t);
    const ana = result.perUser[0];
    // Ana (2025): log 1 bench + row, log 2 squat (twice) + RDL, log 4 shoulder press:
    // 5 distinct exercises x (e1rm, weight) baselines = 10 inserted. d1 bench 50x5 < Ana's 60x8 -> its 2 records
    // soft-deleted (updated). d2 bench 100x5 still beats 60x8 -> its 2 records unchanged (skipped).
    expect(ana.prRecords).toEqual({ inserted: 10, updated: 2, skipped: 2 });
    const all = await t.repo.prs.list(t.profileId, { includeDeleted: true });
    expect(live(all, 'd1')).toEqual([]);
    expect(all.filter((r) => r.workoutLogId === 'd1' && r.deletedAt === STAMP)).toHaveLength(2);
    expect(live(all, 'd2').map((r) => r.value).sort((a, b) => a - b)).toEqual([100, 112.5]);
    const bench = await t.repo.prs.best(t.profileId, 't-bench');
    expect(bench.weight?.value).toBe(100);
    expect(bench.e1rm?.workoutLogId).toBe('d2');
  });

  it('annotates imported logs like finishWorkout and leaves existing logs alone', async () => {
    const t = await seeded();
    const d2Before = await t.repo.logs.get(t.profileId, 'd2');
    await importAna(t);
    expect(await t.repo.logs.get(t.profileId, 'd2')).toEqual(d2Before);
    const imported = (await t.repo.logs.list(t.profileId)).filter((l) => l.id !== 'd1' && l.id !== 'd2');
    expect(imported).toHaveLength(MULTI_USER_DUMP.users.Ana.logs);
    const squatLog = imported.find((l) => l.date === '2025-01-03');
    // Squat slot 1: 80x5 is the first ever (baseline); slot 2: 70x10 has a higher e1RM in the same
    // workout, so one e1rm candidate per workout, still a baseline -> prCount 0, no isPR flags.
    expect(squatLog?.prCount).toBe(0);
    const working = squatLog?.exercises[0].sets.find((s) => s.type === 'working');
    expect(working?.e1rm).toBe(90); // Brzycki 80 x 36 / (37 - 5) = 90
    expect(squatLog?.exercises[0].sets.find((s) => s.type === 'warmup')?.e1rm).toBeUndefined();
  });

  it('corrects a stored record whose values disagree with the recompute, in place', async () => {
    const t = await seeded();
    const backup = await t.repo.exportBackup(t.profileId);
    const target = backup.prRecords.find((r) => r.workoutLogId === 'd2' && r.prType === 'weight');
    if (!target) throw new Error('fixture: d2 weight record missing');
    await t.repo.importBackup({ ...backup, prRecords: [{ ...target, value: 1, kg: 1 }], profiles: [], workoutLogs: [], programs: [] });
    const ana = (await importAna(t)).perUser[0];
    expect(ana.prRecords).toEqual({ inserted: 10, updated: 3, skipped: 1 });
    const fixed = (await t.repo.prs.list(t.profileId)).find((r) => r.id === target.id);
    expect(fixed).toMatchObject({ value: 100, kg: 100, updatedAt: STAMP });
  });

  it('activates the imported plan only when the profile has none, and keeps its settings', async () => {
    const t = await seeded();
    const ana = (await importAna(t)).perUser[0];
    expect(ana.activatedProgramId).not.toBeNull();
    expect((await t.repo.programs.getActive(t.profileId))?.id).toBe(ana.activatedProgramId);
    expect(ana.settingsApplied).toEqual([]);
    expect((await t.repo.profiles.get(t.profileId))?.settings.theme).toBe('tactical');

    const u = await seeded();
    const own = await u.repo.programs.create(u.profileId, template(2), { activate: true });
    const second = (await importAna(u)).perUser[0];
    expect(second.activatedProgramId).toBeNull();
    expect((await u.repo.programs.getActive(u.profileId))?.id).toBe(own.id);
  });

  it('does not resurrect or re-activate an imported plan the user deleted', async () => {
    const t = await seeded();
    const first = (await importAna(t)).perUser[0];
    const planId = first.activatedProgramId;
    if (planId === null) throw new Error('fixture: plan not activated');
    await t.repo.programs.setActive(t.profileId, null);
    await t.repo.programs.softDelete(t.profileId, planId);
    const again = (await importAna(t)).perUser[0];
    expect(again.activatedProgramId).toBeNull();
    expect(again.programs).toEqual({ inserted: 0, updated: 0, skipped: 2 });
    expect(await t.repo.programs.get(t.profileId, planId)).toBeUndefined();
    expect(await t.repo.programs.getActive(t.profileId)).toBeUndefined();
  });
});
