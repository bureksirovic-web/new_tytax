/** finishWorkout only references a live program of the same profile (src/lib/db/repo/finish.ts). */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, freshRepo, template } from './helpers';

describe('finishWorkout program reference', () => {
  it("drops another profile's programId and programSessionId from the log and leaves that program alone", async () => {
    const { repo, db } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const bProgram = await repo.programs.create(b.id, template(2));
    const sessionId = bProgram.sessions[0].id;

    const res = await repo.finishWorkout(draft('d', a.id, [exercise('u', 'bench', [{ kg: 50, reps: 5 }])], { programId: bProgram.id, programSessionId: sessionId }));

    expect(res.advancedProgram).toBeUndefined();
    expect(res.log.programId).toBeUndefined();
    expect(res.log.programSessionId).toBeUndefined();
    expect((await db.workoutLogs.get('d'))?.programId).toBeUndefined();
    expect(await db.programs.get(bProgram.id)).toEqual(bProgram);
  });

  it('keeps and advances an own live program', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const program = await repo.programs.create(a.id, template(2));
    const sessionId = program.sessions[0].id;

    const res = await repo.finishWorkout(draft('d', a.id, [exercise('u', 'bench', [{ kg: 50, reps: 5 }])], { programId: program.id, programSessionId: sessionId }));

    expect(res.log).toMatchObject({ programId: program.id, programSessionId: sessionId });
    expect(res.advancedProgram).toEqual({ programId: program.id, nextSessionIndex: 1 });
  });
});
