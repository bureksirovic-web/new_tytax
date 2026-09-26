/**
 * Pure rotation/session-order helpers for the program manager.
 * Every edit keeps the rotation pointer on the same session id.
 */
import type { Program, ProgramSession } from '@/contracts/domain';

export type RotationPatch = Pick<Program, 'sessions' | 'sessionOrder' | 'currentSessionIndex'>;

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' → local midnight (never `new Date('YYYY-MM-DD')`, which is UTC). */
export function parseLocalDate(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The local calendar day of `now` as 'YYYY-MM-DD'. */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole local days from `a` to `b` (negative when b is earlier). DST-safe via rounding. */
export function daysBetweenLocal(a: string, b: string): number | null {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

/** Legacy calendar rotation (getPredictedSession L6157-6161): ((diff % n) + n) % n. */
export function rotationIndexForDate(start: string, today: string, n: number): number | null {
  if (n <= 0) return null;
  const diff = daysBetweenLocal(start, today);
  if (diff === null) return null;
  return ((diff % n) + n) % n;
}

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
