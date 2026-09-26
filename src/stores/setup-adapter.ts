/**
 * Machine setup adapter (Wave 2, G3 item 3). The notes repo on the frozen
 * contract has no way to write `ExerciseNote.setup`; G2 adds one inside its
 * repository implementation (request docs/v2/requests/G3-W2-01.md). This file
 * duck-types it so the workout UI works before and after that merge.
 *
 * - `loadSetup(repo, profileId, exerciseId)` → the stored setup or undefined.
 *   Uses `notes.getSetup` / `repo.getSetup` when the implementation has one,
 *   else `notes.get(...)?.setup`. An empty setup reads as undefined.
 * - `canSaveSetup(repo)` → true when a setup writer exists.
 * - `saveSetup(repo, profileId, exerciseId, setup)` → `SaveSetupResult`.
 *   Fields are trimmed and empty ones dropped; nothing left clears the setup.
 *   Writer: `notes.setSetup(profileId, exerciseId, setup | undefined)`, else
 *   `repo.setSetup(...)`. Without one: `{ saved: false, reason: 'unsupported' }`
 *   and nothing is written (the UI shows the setup read-only). A throwing
 *   writer gives `{ saved: false, reason: 'error', error }`.
 */
import type { MachineSetup } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';

export const SETUP_FIELDS = ['seat', 'pin', 'backrest', 'benchAngle', 'cable', 'other'] as const satisfies ReadonlyArray<keyof MachineSetup>;

/**
 * Longest stored value per field (free text such as "4" or "30°, rope").
 * Matches G2's `MAX_SETUP_FIELD_LENGTH` (g2/src/lib/db/repo/notes.ts), whose
 * `normalizeSetup` rejects longer values; import it at integration.
 */
export const SETUP_FIELD_MAX = 40;

export type SaveSetupResult =
  | { saved: true; setup: MachineSetup | undefined }
  | { saved: false; reason: 'unsupported' }
  | { saved: false; reason: 'error'; error: unknown };

type SetupReader = (profileId: string, exerciseId: string) => Promise<MachineSetup | undefined>;
type SetupWriter = (profileId: string, exerciseId: string, setup: MachineSetup | undefined) => Promise<unknown>;

function method<T>(owner: unknown, name: string): T | undefined {
  if (typeof owner !== 'object' || owner === null) return undefined;
  const fn = (owner as Record<string, unknown>)[name];
  return typeof fn === 'function' ? (fn.bind(owner) as T) : undefined;
}

function writerOf(repo: Repository): SetupWriter | undefined {
  return method<SetupWriter>(repo.notes, 'setSetup') ?? method<SetupWriter>(repo, 'setSetup');
}

/** Trimmed, length-capped copy without empty fields; undefined when nothing is left. */
export function cleanSetup(setup: MachineSetup | undefined): MachineSetup | undefined {
  if (!setup) return undefined;
  const out: MachineSetup = {};
  for (const key of SETUP_FIELDS) {
    const value = setup[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, SETUP_FIELD_MAX);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function loadSetup(repo: Repository, profileId: string, exerciseId: string): Promise<MachineSetup | undefined> {
  const reader = method<SetupReader>(repo.notes, 'getSetup') ?? method<SetupReader>(repo, 'getSetup');
  if (reader) return cleanSetup(await reader(profileId, exerciseId));
  return cleanSetup((await repo.notes.get(profileId, exerciseId))?.setup);
}

export function canSaveSetup(repo: Repository): boolean {
  return writerOf(repo) !== undefined;
}

export async function saveSetup(
  repo: Repository,
  profileId: string,
  exerciseId: string,
  setup: MachineSetup | undefined,
): Promise<SaveSetupResult> {
  const writer = writerOf(repo);
  if (!writer) return { saved: false, reason: 'unsupported' };
  const clean = cleanSetup(setup);
  try {
    await writer(profileId, exerciseId, clean);
    return { saved: true, setup: clean };
  } catch (error) {
    return { saved: false, reason: 'error', error };
  }
}
