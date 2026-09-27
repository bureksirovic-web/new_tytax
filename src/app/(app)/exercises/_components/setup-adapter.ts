/**
 * Machine setup (per profile + exercise, stored on `ExerciseNote.setup`).
 *
 * Reading is contract-typed: `repo.notes.get(...)?.setup`. Writing needs a
 * repo method the frozen contract does not have (request G4-W2-20):
 * `notes.setSetup(profileId, exerciseId, setup | null)`. G2's implementation
 * (`NotesRepoExt` in src/lib/db/repo/notes.ts, G2-W2-01) exposes exactly that
 * shape plus `getSetup`; `setupWriter` detects it at runtime, and without it
 * the editor stays read-only with an explanation.
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

/**
 * True when `notes.set(p, e, '')` keeps a row that carries a setup (G4-W2-55).
 * G2 shipped that semantics together with `getSetup` + `setSetup`
 * (`NotesRepoExt`), so the pair identifies it; the older repo soft-deletes the
 * whole row, so clearing the note would also drop the setup.
 */
export function clearKeepsSetup(notes: unknown): boolean {
  if (!notes || typeof notes !== 'object') return false;
  const n = notes as { getSetup?: unknown; setSetup?: unknown };
  return typeof n.getSetup === 'function' && typeof n.setSetup === 'function';
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
