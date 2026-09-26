import type { ExerciseNote } from '@/contracts/domain';
import { RepoError, type NotesRepo } from '@/contracts/repo';
import type { RepoContext } from './context';
import { getLiveProfile } from './profile-store';
import { byProfile, desc, paginate, undeleted, visible } from './rows';
import { assertNonEmpty } from './validate';

export function createNotesRepo(ctx: RepoContext): NotesRepo {
  const rowsFor = (profileId: string, exerciseId: string): Promise<ExerciseNote[]> =>
    ctx.db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray();

  return {
    async get(profileId, exerciseId) {
      return (await rowsFor(profileId, exerciseId)).find((n) => !n.deletedAt);
    },

    set: (profileId, exerciseId, content) =>
      ctx.write(async (w) => {
        assertNonEmpty(exerciseId, 'exerciseId');
        if (typeof content !== 'string') throw new RepoError('VALIDATION', 'content must be a string');
        const rows = await rowsFor(profileId, exerciseId);
        const live = rows.find((n) => !n.deletedAt);
        const stamp = ctx.stamp();
        if (content.trim() === '') {
          if (live) {
            await ctx.db.exerciseNotes.put({ ...live, deletedAt: stamp, updatedAt: stamp });
            await w.queue('exercise_notes', 'delete', live.id, profileId);
          }
          return undefined;
        }
        await getLiveProfile(ctx, profileId);
        const base = live ?? rows[0];
        const note: ExerciseNote = base
          ? { ...undeleted(base), content, updatedAt: stamp }
          : { id: ctx.newId(), profileId, exerciseId, content, createdAt: stamp, updatedAt: stamp };
        await ctx.db.exerciseNotes.put(note);
        await w.queue('exercise_notes', 'upsert', note.id, profileId);
        return note;
      }),

    async list(profileId, opts) {
      const rows = visible(await byProfile(ctx.db.exerciseNotes, profileId), opts?.includeDeleted);
      rows.sort((a, b) => desc(a.updatedAt, b.updatedAt));
      return paginate(rows, opts);
    },
  };
}
