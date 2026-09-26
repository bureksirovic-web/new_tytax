/**
 * Pure program-rotation helpers. Persistence (install, activate, advance,
 * delete) lives on the repository: `getRepository().programs`.
 */
import type { Program, ProgramSession } from '@/contracts/domain';

/** The session the rotation pointer names, or null when the program has none (or the pointer is out of range). */
export function getCurrentSession(program: Program): ProgramSession | null {
  const i = program.currentSessionIndex;
  if (!Number.isInteger(i) || i < 0) return null;
  return program.sessions[i] ?? null;
}

/** Index the pointer moves to after the current session: (i + 1) % sessions.length; 0 when there are no sessions. */
export function nextSessionIndex(program: Program): number {
  const n = program.sessions.length;
  if (n === 0) return 0;
  const i = Number.isInteger(program.currentSessionIndex) && program.currentSessionIndex >= 0 ? program.currentSessionIndex : -1;
  return (i + 1) % n;
}

/** A rest day in the rotation. */
export function isRestSession(session: ProgramSession): boolean {
  return session.isRest === true;
}
