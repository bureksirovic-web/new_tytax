/**
 * Setup-link "Create" logic (family-profiles plan, Piece 1). Kept apart from
 * the UI so it can be unit-tested against a minimal fake repository.
 *
 * Idempotent (AC3): a profile with the same name (case-insensitive, NFC) whose
 * active program already has the matching presetId is skipped, and the skip
 * is reported. ADOPT rule (amendments after 1b, blocker 1): a device with
 * exactly one untouched default profile (the app's own first-run name, 0
 * workout logs, no active program) has that profile renamed into the first
 * setup profile instead of a new one being created.
 */
import type { Language, Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import type { SetupPayload, SetupProfileInput } from '@/lib/setup-link';

export type SetupProfileStatus = 'created' | 'adopted' | 'skipped';

export interface SetupProfileResult {
  input: SetupProfileInput;
  status: SetupProfileStatus;
  profileId: string;
  /** The preset's display name (for the result screen). */
  programName: string;
}

export interface ApplySetupOptions {
  /** The app's own first-run profile name (AppBootstrap's DEFAULT_PROFILE_NAME). */
  defaultProfileName: string;
  /** Used for a setup profile that names no `language`. */
  fallbackLanguage: Language;
}

/** The repo surface `applySetupPayload` needs (a subset of `Repository`, easy to fake in tests). */
export type SetupRepo = Pick<Repository, 'profiles' | 'programs' | 'logs'>;

const sameName = (a: string, b: string): boolean => a.normalize('NFC').toLocaleLowerCase() === b.normalize('NFC').toLocaleLowerCase();

/** The device's only profile qualifies for adoption: untouched default, no logs, no active program. */
async function findAdoptable(repo: SetupRepo, defaultProfileName: string): Promise<Profile | undefined> {
  const all = await repo.profiles.list();
  if (all.length !== 1) return undefined;
  const [only] = all;
  if (only.name !== defaultProfileName || only.activeProgramId !== null) return undefined;
  const logCount = await repo.logs.count(only.id);
  return logCount === 0 ? only : undefined;
}

function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** An existing profile matching `input`'s name whose active program already installed the same preset. */
async function findSkippable(repo: SetupRepo, input: SetupProfileInput): Promise<Profile | undefined> {
  const all = await repo.profiles.list();
  const match = all.find((p) => sameName(p.name, input.name));
  if (!match) return undefined;
  const active = await repo.programs.getActive(match.id);
  return active?.presetId === input.presetId ? match : undefined;
}

async function installPreset(repo: SetupRepo, profileId: string, presetId: string): Promise<string> {
  // Lazy: keeps the full preset catalog out of the /setup route's first-load JS.
  const { getPresetById } = await import('@/lib/programs/presets');
  const template = getPresetById(presetId);
  // The zod schema already checked presetId resolves; this is belt-and-suspenders.
  if (!template) throw new Error(`applySetupPayload: unknown preset id "${presetId}"`);
  await repo.programs.create(profileId, template, { activate: true });
  return template.name;
}

/**
 * Applies every profile of a validated setup payload, in order, and sets the
 * first created/adopted profile active. Returns a per-profile report; nothing
 * is written for a skipped profile.
 */
export async function applySetupPayload(repo: SetupRepo, payload: SetupPayload, opts: ApplySetupOptions): Promise<SetupProfileResult[]> {
  const results: SetupProfileResult[] = [];
  let adoptable = await findAdoptable(repo, opts.defaultProfileName);
  let firstId: string | undefined;

  for (const input of payload.profiles) {
    const skip = await findSkippable(repo, input);
    if (skip) {
      const active = await repo.programs.getActive(skip.id);
      results.push({ input, status: 'skipped', profileId: skip.id, programName: active?.name ?? input.presetId });
      // Payload order decides the active profile, skipped or not.
      firstId ??= skip.id;
      continue;
    }

    let profileId: string;
    let status: SetupProfileStatus;
    const patch = definedOnly({ birthYear: input.birthYear, experienceLevel: input.experienceLevel });

    if (adoptable) {
      const target = adoptable;
      adoptable = undefined;
      await repo.profiles.update(target.id, { name: input.name, ...patch });
      if (input.language) await repo.profiles.updateSettings(target.id, { language: input.language });
      profileId = target.id;
      status = 'adopted';
    } else {
      const created = await repo.profiles.create({
        name: input.name,
        settings: { language: input.language ?? opts.fallbackLanguage },
      });
      if (Object.keys(patch).length > 0) await repo.profiles.update(created.id, patch);
      profileId = created.id;
      status = 'created';
    }

    const programName = await installPreset(repo, profileId, input.presetId);
    firstId ??= profileId;
    results.push({ input, status, profileId, programName });
  }

  if (firstId) await repo.profiles.setActive(firstId);
  return results;
}
