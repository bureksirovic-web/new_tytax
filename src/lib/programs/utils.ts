import type { Program, ProgramSession } from '@/types/program';
import { db } from '@/lib/db/dexie';
import { generateId, isoDate } from '@/lib/utils';

/**
 * Activate a program: set every program for the profile to isActive=false,
 * then set the target to isActive=true and reset currentSessionIndex if unset.
 */
export async function activateProgram(programId: string): Promise<void> {
  const target = await db.programs.get(programId);
  if (!target) return;

  // Deactivate all programs for this profile
  const all = await db.programs.where('profileId').equals(target.profileId).toArray();
  await Promise.all(
    all
      .filter((p) => p.isActive)
      .map((p) => db.programs.update(p.id, { isActive: false, updatedAt: isoDate() })),
  );

  await db.programs.update(programId, {
    isActive: true,
    currentSessionIndex: target.currentSessionIndex ?? 0,
    updatedAt: isoDate(),
  });
}

/**
 * Advance to the next session in the rotation (wraps around).
 */
export async function advanceSession(programId: string): Promise<void> {
  const program = await db.programs.get(programId);
  if (!program) return;
  const next = (program.currentSessionIndex + 1) % program.sessions.length;
  await db.programs.update(programId, { currentSessionIndex: next, updatedAt: isoDate() });
}

/**
 * Return the current ProgramSession for the given program, or null if sessions is empty.
 */
export function getCurrentSession(program: Program): ProgramSession | null {
  return program.sessions[program.currentSessionIndex] ?? null;
}

/**
 * Install a preset as a new user-owned program.
 * Clones the template, assigns a fresh id + profileId, marks inactive, returns the new id.
 */
export async function installPreset(
  preset: Omit<Program, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>,
  profileId: string,
): Promise<string> {
  const id = generateId();
  const now = isoDate();
  const newProgram: Program = {
    ...(preset as Program),
    id,
    profileId,
    isActive: false,
    currentSessionIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.programs.add(newProgram);
  return id;
}

/**
 * Delete a program by id (soft-delete via deletedAt, matching WorkoutLog pattern).
 * Uses hard delete since Program type has optional deletedAt and the index supports it.
 */
export async function deleteProgram(programId: string): Promise<void> {
  await db.programs.update(programId, {
    deletedAt: new Date().toISOString(),
    isActive: false,
    updatedAt: isoDate(),
  });
}
