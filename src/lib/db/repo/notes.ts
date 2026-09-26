/**
 * Exercise notes (free text) plus the Wave 2 machine setup (G2-W2-01).
 *
 * A note is live while it has content OR a setup: `set(.., '')` on a note
 * that still carries a setup keeps the row (content becomes ''), and
 * `setSetup(.., null)` on a note with empty content soft-deletes it. A
 * tombstoned row that comes back never resurrects its old content or setup.
 */
import type { ExerciseNote, MachineSetup } from '@/contracts/domain';
import { RepoError, type NotesRepo, type Repository } from '@/contracts/repo';
import type { RepoContext, WriteScope } from './context';
import { getLiveProfile } from './profile-store';
import { byProfile, desc, paginate, undeleted, visible } from './rows';
import { assertNonEmpty } from './validate';

export const MACHINE_SETUP_KEYS = ['seat', 'pin', 'backrest', 'benchAngle', 'cable', 'other'] as const satisfies ReadonlyArray<keyof MachineSetup>;
export const MAX_SETUP_FIELD_LENGTH = 40;

/** Implementation-level notes API (proposed for the contract in docs/v2/requests/G2-W2-01.md). */
export interface NotesRepoExt extends NotesRepo {
  /** Live note's setup, or undefined. */
  getSetup(profileId: string, exerciseId: string): Promise<MachineSetup | undefined>;
  /** Replaces the setup; `null` or `{}` clears it. Returns the live note, or undefined when it ended deleted. */
  setSetup(profileId: string, exerciseId: string, setup: MachineSetup | null): Promise<ExerciseNote | undefined>;
}

const SETUP_KEYS: ReadonlySet<string> = new Set(MACHINE_SETUP_KEYS);

/** Validated, trimmed copy; undefined when it holds no field. @throws RepoError VALIDATION */
export function normalizeSetup(setup: unknown): MachineSetup | undefined {
  if (setup === null || setup === undefined) return undefined;
  if (typeof setup !== 'object' || Array.isArray(setup)) throw new RepoError('VALIDATION', 'setup must be an object');
  const out: MachineSetup = {};
  for (const [key, value] of Object.entries(setup)) {
    if (!SETUP_KEYS.has(key)) throw new RepoError('VALIDATION', `setup.${key} is not a known field`);
    if (value === undefined) continue;
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === '' || text.length > MAX_SETUP_FIELD_LENGTH) {
      throw new RepoError('VALIDATION', `setup.${key} must be a non-empty string of at most ${MAX_SETUP_FIELD_LENGTH} characters`);
    }
    out[key as keyof MachineSetup] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The notes repo of `repo` with the setup methods. @throws RepoError NOT_IMPLEMENTED on a repo without them. */
export function getNotesExt(repo: Pick<Repository, 'notes'>): NotesRepoExt {
  const notes = repo.notes as Partial<NotesRepoExt>;
  if (typeof notes.getSetup !== 'function' || typeof notes.setSetup !== 'function') {
    throw new RepoError('NOT_IMPLEMENTED', 'notes.setSetup/getSetup are not available on this repository');
  }
  return repo.notes as NotesRepoExt;
}

export function createNotesRepo(ctx: RepoContext): NotesRepoExt {
  const rowsFor = (profileId: string, exerciseId: string): Promise<ExerciseNote[]> =>
    ctx.db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray();

  /** Writes `content` + `setup` onto the live row (or a fresh one); soft-deletes when both are empty. */
  async function write(w: WriteScope, profileId: string, exerciseId: string, next: (live?: ExerciseNote) => { content: string; setup?: MachineSetup }) {
    const rows = await rowsFor(profileId, exerciseId);
    const live = rows.find((n) => !n.deletedAt);
    const { content, setup } = next(live);
    const stamp = ctx.stamp();
    if (content.trim() === '' && !setup) {
      if (live) {
        await ctx.db.exerciseNotes.put({ ...live, deletedAt: stamp, updatedAt: stamp });
        await w.queue('exercise_notes', 'delete', live.id, profileId);
      }
      return undefined;
    }
    await getLiveProfile(ctx, profileId);
    const base = live ?? rows[0];
    const kept: ExerciseNote | undefined = base ? undeleted(base) : undefined;
    if (kept) delete kept.setup;
    const note: ExerciseNote = kept
      ? { ...kept, content, updatedAt: stamp }
      : { id: ctx.newId(), profileId, exerciseId, content, createdAt: stamp, updatedAt: stamp };
    if (setup) note.setup = setup;
    await ctx.db.exerciseNotes.put(note);
    await w.queue('exercise_notes', 'upsert', note.id, profileId);
    return note;
  }

  return {
    async get(profileId, exerciseId) {
      return (await rowsFor(profileId, exerciseId)).find((n) => !n.deletedAt);
    },

    set: (profileId, exerciseId, content) =>
      ctx.write(async (w) => {
        assertNonEmpty(exerciseId, 'exerciseId');
        if (typeof content !== 'string') throw new RepoError('VALIDATION', 'content must be a string');
        return write(w, profileId, exerciseId, (live) => ({ content, setup: live?.setup }));
      }),

    async getSetup(profileId, exerciseId) {
      const live = (await rowsFor(profileId, exerciseId)).find((n) => !n.deletedAt);
      return live?.setup ? { ...live.setup } : undefined;
    },

    setSetup: (profileId, exerciseId, setup) =>
      ctx.write(async (w) => {
        assertNonEmpty(exerciseId, 'exerciseId');
        const clean = normalizeSetup(setup);
        return write(w, profileId, exerciseId, (live) => ({ content: live?.content ?? '', setup: clean }));
      }),

    async list(profileId, opts) {
      const rows = visible(await byProfile(ctx.db.exerciseNotes, profileId), opts?.includeDeleted);
      rows.sort((a, b) => desc(a.updatedAt, b.updatedAt));
      return paginate(rows, opts);
    },
  };
}
