/**
 * Pure rotation/session-order edits for the program manager (G4-only; the
 * calendar alignment lives in `@/lib/programs/calendar`).
 * Every edit keeps the rotation pointer on the same session id.
 */
import type { Program, ProgramSession } from '@/contracts/domain';

export type RotationPatch = Pick<Program, 'sessions' | 'sessionOrder' | 'currentSessionIndex'>;

function finish(sessions: ProgramSession[], pointerId: string | undefined): RotationPatch {
  const renumbered = sessions.map((s, i) => ({ ...s, dayIndex: i }));
  const idx = pointerId ? renumbered.findIndex((s) => s.id === pointerId) : -1;
  return {
    sessions: renumbered,
    sessionOrder: renumbered.map((s) => s.name),
    currentSessionIndex: idx >= 0 ? idx : 0,
  };
}

function pointerId(program: Pick<Program, 'sessions' | 'currentSessionIndex'>): string | undefined {
  return program.sessions[program.currentSessionIndex]?.id;
}

/** Move the session at `from` to `to`; the pointer follows its session. */
export function moveSession(program: Pick<Program, 'sessions' | 'currentSessionIndex'>, from: number, to: number): RotationPatch {
  const sessions = [...program.sessions];
  if (from < 0 || from >= sessions.length || to < 0 || to >= sessions.length) return finish(sessions, pointerId(program));
  const [moved] = sessions.splice(from, 1);
  sessions.splice(to, 0, moved);
  return finish(sessions, pointerId(program));
}

/** Append a rest day at the end of the rotation. */
export function addRestDay(program: Pick<Program, 'sessions' | 'currentSessionIndex'>, name: string, newId: () => string = () => crypto.randomUUID()): RotationPatch {
  const rest: ProgramSession = { id: newId(), programId: '', name, dayIndex: program.sessions.length, exercises: [], isRest: true };
  return finish([...program.sessions, rest], pointerId(program));
}

/**
 * Remove the rest day at `index` (training days are never removed here).
 * If the pointer was on it, it moves to the session that takes its place (wrapping).
 */
export function removeRestDay(program: Pick<Program, 'sessions' | 'currentSessionIndex'>, index: number): RotationPatch {
  const target = program.sessions[index];
  if (!target?.isRest) return finish([...program.sessions], pointerId(program));
  const sessions = program.sessions.filter((_, i) => i !== index);
  let pid = pointerId(program);
  if (pid === target.id) pid = sessions[sessions.length === 0 ? 0 : index % sessions.length]?.id;
  return finish(sessions, pid);
}

/** A rotation patch that also changes the number of training days (`frequency` follows). */
export type DayPatch = RotationPatch & Pick<Program, 'frequency'>;

function withFrequency(patch: RotationPatch): DayPatch {
  return { ...patch, frequency: patch.sessions.filter((s) => !s.isRest).length };
}

/**
 * Add an empty training day right after the last training day (so trailing rest
 * days stay last). `frequency` becomes the new number of training days.
 */
export function addTrainingDay(program: Pick<Program, 'sessions' | 'currentSessionIndex'>, name: string, newId: () => string = () => crypto.randomUUID()): DayPatch {
  const day: ProgramSession = { id: newId(), programId: '', name, dayIndex: 0, exercises: [], isRest: false };
  let lastTraining = -1;
  program.sessions.forEach((s, i) => {
    if (!s.isRest) lastTraining = i;
  });
  const sessions = [...program.sessions];
  sessions.splice(lastTraining + 1, 0, day);
  return withFrequency(finish(sessions, pointerId(program)));
}

/**
 * Remove the training day at `index`. The last remaining training day is never
 * removed. The pointer follows its session; if it was on the removed day it
 * moves to the session that takes its place (wrapping).
 */
export function removeTrainingDay(program: Pick<Program, 'sessions' | 'currentSessionIndex'>, index: number): DayPatch {
  const target = program.sessions[index];
  const training = program.sessions.filter((s) => !s.isRest).length;
  if (!target || target.isRest || training <= 1) return withFrequency(finish([...program.sessions], pointerId(program)));
  const sessions = program.sessions.filter((_, i) => i !== index);
  let pid = pointerId(program);
  if (pid === target.id) pid = sessions[index % sessions.length]?.id;
  return withFrequency(finish(sessions, pid));
}

/** Training (non-rest) sessions. */
export function trainingSessions(program: Pick<Program, 'sessions'>): ProgramSession[] {
  return program.sessions.filter((s) => !s.isRest);
}

/** Designed = training sessions with at least one exercise (legacy ProgramManager L4131-4185). */
export function programProgress(program: Pick<Program, 'sessions'>): { filled: number; total: number } {
  const training = trainingSessions(program);
  return { filled: training.filter((s) => s.exercises.length > 0).length, total: training.length };
}

/** Incomplete: no training day at all, or any training day without exercises. Activation is gated on this. */
export function isIncomplete(program: Pick<Program, 'sessions'>): boolean {
  const { filled, total } = programProgress(program);
  return total === 0 || filled < total;
}
