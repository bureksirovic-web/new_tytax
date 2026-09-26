/**
 * Adapter for G3's `startFromLog` workout-store action (request G4-25, Wave 2).
 * v2-g4's store does not have it (it lands with the G3 merge), so it is detected
 * at runtime on the store state; the "Repeat workout" button stays hidden without it.
 */
import type { WorkoutDraft, WorkoutLog } from '@/contracts/domain';

/**
 * The G4-25 signature. G3's store (Wave 2) implements it as a synchronous
 * `startFromLog(profileId, log): WorkoutDraft` that replaces any draft, so the
 * caller asks before replacing; null/undefined (a refusing implementation) and
 * a Promise are tolerated.
 */
export type StartFromLog = (
  profileId: string,
  log: WorkoutLog,
) => WorkoutDraft | null | undefined | Promise<WorkoutDraft | null | undefined>;

/** The action when the store state carries it, else null. */
export function resolveStartFromLog(state: unknown): StartFromLog | null {
  if (typeof state !== 'object' || state === null) return null;
  const fn = (state as { startFromLog?: unknown }).startFromLog;
  return typeof fn === 'function' ? (fn as StartFromLog) : null;
}

export type RepeatBlock = 'none' | 'own-draft' | 'foreign-draft';

/** What stands in the way of repeating `log`: nothing, this profile's draft, or another profile's draft. */
export function repeatBlock(draft: Pick<WorkoutDraft, 'profileId'> | null | undefined, profileId: string): RepeatBlock {
  if (!draft) return 'none';
  return draft.profileId === profileId ? 'own-draft' : 'foreign-draft';
}
