/**
 * Pure edits of a program's sessions and their exercise slots.
 */
import type { Exercise, Program, ProgramExercise, ProgramSession } from '@/contracts/domain';

/** Reps: "8", "8-12", "10/side", "10-15/side". */
export const REPS_PATTERN = /^\d+(-\d+)?(\/side)?$/;

export function isValidReps(reps: string): boolean {
  return REPS_PATTERN.test(reps.trim());
}

export const SETS_MIN = 1;
export const SETS_MAX = 10;
export const REST_MIN = 0;
export const REST_MAX = 600;
export const REST_STEP = 15;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Move `items[from]` to `to`; out-of-range moves return a copy unchanged. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** The program's sessions with `fn` applied to the one with `sessionId`. */
export function mapSession(
  program: Pick<Program, 'sessions'>,
  sessionId: string,
  fn: (s: ProgramSession) => ProgramSession,
): ProgramSession[] {
  return program.sessions.map((s) => (s.id === sessionId ? fn(s) : s));
}

/** Remove the slot at `index` (by index: a session may repeat an exercise id). */
export function removeExerciseAt(session: ProgramSession, index: number): ProgramSession {
  return { ...session, exercises: session.exercises.filter((_, i) => i !== index) };
}

export function moveExercise(session: ProgramSession, from: number, to: number): ProgramSession {
  return { ...session, exercises: moveItem(session.exercises, from, to) };
}

export function patchExerciseAt(session: ProgramSession, index: number, patch: Partial<ProgramExercise>): ProgramSession {
  return { ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)) };
}

/** Slot for a catalog exercise with its default prescription. */
export function slotFromExercise(ex: Exercise): ProgramExercise {
  const slot: ProgramExercise = {
    exerciseId: ex.id,
    exerciseName: ex.name,
    modality: ex.modality,
    sets: ex.defaultSets,
    reps: ex.defaultReps,
  };
  if (ex.restSeconds !== undefined) slot.restSeconds = ex.restSeconds;
  if (ex.tempo !== undefined) slot.tempo = ex.tempo;
  return slot;
}

/** Unique exercise ids of a session in order (the slot editor toggles by id). */
export function selectedIdsOf(session: Pick<ProgramSession, 'exercises'>): string[] {
  return [...new Set(session.exercises.map((e) => e.exerciseId))];
}

/**
 * The slots to store after the slot editor: selection order, keeping the
 * existing sets/reps/rest of exercises already in the session (every
 * occurrence, so a deliberately repeated exercise survives a save), catalog
 * defaults for new ones. Ids missing from both are dropped.
 */
export function mergeSelection(
  existing: readonly ProgramExercise[],
  selectedIds: readonly string[],
  lookup: (id: string) => Exercise | undefined,
): ProgramExercise[] {
  const keptIds = selectedIds.filter((id) => existing.some((e) => e.exerciseId === id));
  const firstNew = selectedIds.findIndex((id) => !keptIds.includes(id));
  const keptFirst = firstNew === -1 || selectedIds.slice(firstNew).every((id) => !keptIds.includes(id));
  const originalOrder = selectedIdsOf({ exercises: existing.filter((e) => keptIds.includes(e.exerciseId)) });
  if (keptFirst && originalOrder.join('\u0000') === keptIds.join('\u0000')) {
    // Kept exercises not reordered: keep their exact arrangement (interleaved repeats too), then the new ones.
    const out = existing.filter((e) => keptIds.includes(e.exerciseId)).map((e) => ({ ...e }));
    for (const id of selectedIds.slice(keptIds.length)) {
      const ex = lookup(id);
      if (ex) out.push(slotFromExercise(ex));
    }
    return out;
  }
  const out: ProgramExercise[] = [];
  for (const id of selectedIds) {
    const kept = existing.filter((e) => e.exerciseId === id);
    if (kept.length > 0) {
      for (const k of kept) out.push({ ...k });
      continue;
    }
    const ex = lookup(id);
    if (ex) out.push(slotFromExercise(ex));
  }
  return out;
}
