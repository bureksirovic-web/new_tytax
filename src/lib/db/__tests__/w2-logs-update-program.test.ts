/**
 * logs.update keeps the log→program reference to what finishWorkout would
 * store (finish.ts: "Only a live program of this profile is referenced"):
 * a foreign, missing or soft-deleted program is refused with NOT_FOUND, as
 * programs.setActive does, and a programSessionId needs a program.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, expectCode, freshRepo, template } from './helpers';

async function setup() {
  const t = freshRepo();
  const p = (await t.repo.profiles.create({ name: 'P' })).id;
  const q = (await t.repo.profiles.create({ name: 'Q' })).id;
  const own = await t.repo.programs.create(p, template(3), { activate: true });
  const foreign = await t.repo.programs.create(q, template(2));
  await t.repo.finishWorkout(draft('L1', p, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }])], { programId: own.id }));
  return { t, p, q, own, foreign };
}

describe('logs.update of programId / programSessionId', () => {
  it('the finished log stores its own program', async () => {
    const { t, p, own } = await setup();
    expect((await t.repo.logs.get(p, 'L1'))?.programId).toBe(own.id);
  });

  it('a patch naming another profile program is refused and changes nothing', async () => {
    const { t, p, own, foreign } = await setup();
    await expectCode(t.repo.logs.update(p, 'L1', { programId: foreign.id }), 'NOT_FOUND');
    expect((await t.repo.logs.get(p, 'L1'))?.programId).toBe(own.id);
  });

  it('a patch naming a missing or soft-deleted program is refused', async () => {
    const { t, p, own } = await setup();
    await expectCode(t.repo.logs.update(p, 'L1', { programId: 'no-such-program' }), 'NOT_FOUND');
    const other = await t.repo.programs.create(p, template(2));
    await t.repo.programs.softDelete(p, other.id);
    await expectCode(t.repo.logs.update(p, 'L1', { programId: other.id }), 'NOT_FOUND');
    expect((await t.repo.logs.get(p, 'L1'))?.programId).toBe(own.id);
  });

  it('a live program of the same profile is accepted', async () => {
    const { t, p } = await setup();
    const other = await t.repo.programs.create(p, template(2));
    const edited = await t.repo.logs.update(p, 'L1', { programId: other.id, programSessionId: other.sessions[0].id });
    expect(edited).toMatchObject({ programId: other.id, programSessionId: other.sessions[0].id });
  });

  it('a programSessionId on a log without a program is refused', async () => {
    const { t, p } = await setup();
    await t.repo.finishWorkout(draft('L2', p, []));
    await expectCode(t.repo.logs.update(p, 'L2', { programSessionId: 's1' }), 'VALIDATION');
    expect((await t.repo.logs.get(p, 'L2'))?.programSessionId).toBeUndefined();
  });

  it('no dangling program id reaches the export after a refused patch', async () => {
    const { t, p, own, foreign } = await setup();
    await expectCode(t.repo.logs.update(p, 'L1', { programId: foreign.id }), 'NOT_FOUND');
    const backup = await t.repo.exportBackup(p);
    expect(backup.workoutLogs[0].programId).toBe(own.id);
    expect(backup.programs.map((x) => x.id)).toContain(own.id);
  });
});
