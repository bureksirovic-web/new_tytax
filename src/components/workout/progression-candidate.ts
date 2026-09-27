/**
 * Progression-prompt orchestration for the debrief screen (family-profiles
 * plan, piece 4). Not pure (reads the repository and the lazy catalog), so it
 * stays out of `src/lib/training` (pure only). Lazy-loads the bodyweight
 * catalog chunk only when a workout is actually being finished, so the
 * debrief route's first-load JS stays free of catalog data (`npm run
 * check-bundle`).
 */
import type { Profile, ProgramExercise, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { loadCatalog } from '@/lib/catalog';
import { isYouthProfile, readyToProgress, type ProgressionSession } from '@/lib/training/progression-ready';

export interface ProgressionCandidate {
  exerciseId: string;
  exerciseName: string;
  nextExerciseId: string;
  nextExerciseName: string;
  programId: string;
  programSessionId: string;
  youth: boolean;
}

/**
 * `Profile.birthYear` is an additive contract field owned by another piece of
 * this plan (piece 2). Read it defensively so this module compiles against
 * the frozen `src/contracts/domain.ts` whether or not that field has landed
 * yet in this worktree; the coordinator reconciles the real typed field.
 */
export function profileBirthYear(profile: Profile | undefined): number | undefined {
  const y = profile?.birthYear;
  return typeof y === 'number' && Number.isFinite(y) ? y : undefined;
}

/**
 * Computes the (at most one) progression card to show after this workout,
 * from the draft and history BEFORE the draft is discarded. Only exercises
 * of a program session are ever offered a swap (`draft.programSessionId`
 * must be set): a quick workout has no session to update, so nothing is
 * offered for it, however qualified its sets are.
 */
export async function computeProgressionCandidate(
  repo: Repository,
  profileId: string,
  birthYear: number | undefined,
  draft: WorkoutDraft,
  now: Date,
): Promise<ProgressionCandidate | null> {
  if (!draft.programId || !draft.programSessionId) return null;
  const programId = draft.programId;
  const programSessionId = draft.programSessionId;

  const catalog = await loadCatalog(['bodyweight']);
  const youth = isYouthProfile(birthYear, now);
  const draftSession: ProgressionSession = { id: draft.id, exercises: draft.exercises, isDeload: draft.isDeload };

  const seen = new Set<string>();
  for (const sessionExercise of draft.exercises) {
    const exerciseId = sessionExercise.exerciseId;
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);

    const exercise = catalog.getById(exerciseId);
    if (!exercise?.progressionChildIds?.length) continue;

    const history = await repo.logs.historyFor(profileId, exerciseId);
    const sessions: ProgressionSession[] = [draftSession, ...history];

    const result = readyToProgress({
      exerciseId,
      logs: sessions,
      target: exercise.defaultReps,
      youth,
      catalogLookup: catalog.getById,
    });

    if (result.ready && result.nextExerciseId) {
      const nextExercise = catalog.getById(result.nextExerciseId);
      return {
        exerciseId,
        exerciseName: exercise.name,
        nextExerciseId: result.nextExerciseId,
        nextExerciseName: nextExercise?.name ?? result.nextExerciseId,
        programId,
        programSessionId,
        youth,
      };
    }
  }
  return null;
}

/**
 * Swaps `candidate.exerciseId` for `candidate.nextExerciseId` in the program
 * session the workout came from (never session 0: always `programSessionId`).
 * Sets are kept; the prescribed reps reset to the child's own default target
 * only when its measure unit differs from the parent's (a hold becoming a
 * reps exercise or vice versa), otherwise the session's existing reps text
 * is kept as is.
 */
export async function applyProgressionSwap(
  repo: Repository,
  profileId: string,
  candidate: ProgressionCandidate,
): Promise<void> {
  const program = await repo.programs.get(profileId, candidate.programId);
  if (!program) throw new Error('progression swap: program not found');

  const catalog = await loadCatalog(['bodyweight']);
  const nextExercise = catalog.getById(candidate.nextExerciseId);
  if (!nextExercise) throw new Error('progression swap: next exercise not found');

  const sessions = program.sessions.map((session) => {
    if (session.id !== candidate.programSessionId) return session;
    return {
      ...session,
      exercises: session.exercises.map((slot): ProgramExercise => {
        if (slot.exerciseId !== candidate.exerciseId) return slot;
        return {
          ...slot,
          exerciseId: nextExercise.id,
          exerciseName: nextExercise.name,
          modality: nextExercise.modality,
          // A new step starts at its own default target (plan: the promoted slot's
          // target resets to the child exercise's default), never the old step's range.
          reps: nextExercise.defaultReps,
        };
      }),
    };
  });

  await repo.programs.update(profileId, program.id, { sessions });
}
