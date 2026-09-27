/**
 * Refuter R2 (2026-09-27): finishing a program workout advanced the rotation
 * from the pointer as it was at finish time, not from the session trained
 * (draft.programSessionId), so a pointer moved during the workout (rotation
 * panel edit, sync from another device) skipped or repeated sessions.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, freshRepo, template } from './helpers';

async function setup() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'A' });
  const program = await t.repo.programs.create(p.id, template(5), { activate: true });
  return { ...t, p, program };
}

const bench = () => [exercise('u', 'bench', [{ kg: 50, reps: 5 }])];

describe('finishWorkout advances from the session trained', () => {
  it('the pointer moved to 3 during a session-0 workout: finishing sets it to 1', async () => {
    const { repo, p, program } = await setup();
    const trained = program.sessions[0];
    await repo.programs.update(p.id, program.id, { currentSessionIndex: 3 });

    const res = await repo.finishWorkout(draft('d1', p.id, bench(), { programId: program.id, programSessionId: trained.id }));

    expect(res.log.programSessionId).toBe(trained.id);
    expect(res.advancedProgram).toEqual({ programId: program.id, nextSessionIndex: 1 });
    expect((await repo.programs.get(p.id, program.id))?.currentSessionIndex).toBe(1);
  });

  it('wraps after the last session', async () => {
    const { repo, p, program } = await setup();
    const res = await repo.finishWorkout(draft('d2', p.id, bench(), { programId: program.id, programSessionId: program.sessions[4].id }));
    expect(res.advancedProgram?.nextSessionIndex).toBe(0);
  });

  it('falls back to the pointer when the trained session no longer exists (or none is named)', async () => {
    const { repo, p, program } = await setup();
    await repo.programs.update(p.id, program.id, { currentSessionIndex: 2 });
    const gone = await repo.finishWorkout(draft('d3', p.id, bench(), { programId: program.id, programSessionId: 'deleted-session' }));
    expect(gone.advancedProgram?.nextSessionIndex).toBe(3);
    const unnamed = await repo.finishWorkout(draft('d4', p.id, bench(), { programId: program.id }));
    expect(unnamed.advancedProgram?.nextSessionIndex).toBe(4);
  });
});
