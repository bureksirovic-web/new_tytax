/**
 * Machine setup (per profile + exercise, stored on `ExerciseNote.setup`).
 *
 * Reading is contract-typed: `repo.notes.get(...)?.setup`. Writing needs a
 * repo method the contract does not have yet (request G4-W2-20):
 * `notes.setSetup(profileId, exerciseId, setup | null)`. `setupWriter` detects
 * it at runtime; without it the editor stays read-only with an explanation.
 */
import type { ExerciseNote, MachineSetup } from '@/contracts/domain';

export const SETUP_FIELDS = ['seat', 'pin', 'backrest', 'benchAngle', 'cable', 'other'] as const;
export type SetupField = (typeof SETUP_FIELDS)[number];
export type SetupDraft = Record<SetupField, string>;

/** Longest value kept per field (free text such as "4", "30°", "rope, 2nd hole"). */
export const SETUP_MAX = 40;

export interface SetupWriter {
  setSetup(profileId: string, exerciseId: string, setup: MachineSetup | null): Promise<ExerciseNote | undefined>;
}

/** The repo's setup writer when the notes repo exposes one, else undefined. */
export function setupWriter(notes: unknown): SetupWriter | undefined {
  if (!notes || typeof notes !== 'object') return undefined;
  const fn = (notes as { setSetup?: unknown }).setSetup;
  if (typeof fn !== 'function') return undefined;
  return {
    setSetup: (profileId, exerciseId, setup) =>
      (fn as SetupWriter['setSetup']).call(notes, profileId, exerciseId, setup),
  };
}

/** Stored setup → editable strings (missing fields empty). */
export function toDraft(setup: MachineSetup | undefined): SetupDraft {
  const d = {} as SetupDraft;
  for (const f of SETUP_FIELDS) d[f] = typeof setup?.[f] === 'string' ? setup[f] : '';
  return d;
}

/** Draft → value to store: trimmed, capped, empty fields dropped; all empty → null (clears the setup). */
export function normalizeSetup(draft: Partial<SetupDraft>): MachineSetup | null {
  const out: MachineSetup = {};
  for (const f of SETUP_FIELDS) {
    const v = (draft[f] ?? '').trim().slice(0, SETUP_MAX);
    if (v) out[f] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** True when two drafts would store the same setup. */
export function sameSetup(a: Partial<SetupDraft>, b: Partial<SetupDraft>): boolean {
  return JSON.stringify(normalizeSetup(a)) === JSON.stringify(normalizeSetup(b));
}
