/**
 * `window.__tytaxE2E` (contract: `E2EHooks` in `@/contracts/fixtures`).
 *
 * Loaded only through a dynamic import from `AppBootstrap`, and only outside
 * production builds or when the build ran with NEXT_PUBLIC_E2E_HOOKS=1, so it
 * never ships in the normal production bundle. Every seed goes through the
 * repository, the same path the app uses; nothing writes Dexie directly.
 */
import type { ProgramTemplate, WorkoutDraft } from '@/contracts/domain';
import { buildWorkoutLog, type E2EHooks, type SeedProgramInput } from '@/contracts/fixtures';
import type { BackupV3, Repository } from '@/contracts/repo';
import { getPresetById } from '@/lib/programs/presets';
import { WORKOUT_DRAFT_STORAGE_KEY } from '@/stores/workout-store';

export interface E2EHooksOptions {
  /** Name `reset()` gives the profile it re-creates (the app's first-run profile). */
  defaultProfileName: string;
  /** Default: `window.localStorage`, read lazily. */
  storage?: () => Storage;
  /** Default: `new Date()`. */
  now?: () => Date;
  /** Default: `crypto.randomUUID()`. */
  newId?: () => string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isWorkoutDraft(v: unknown): v is WorkoutDraft {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.profileId === 'string' &&
    typeof v.sessionName === 'string' &&
    typeof v.startedAt === 'string' &&
    Array.isArray(v.exercises)
  );
}

/** The draft the workout store persisted (`{ state: { draft }, version }`), or null. */
export function readPersistedDraft(storage: Storage): WorkoutDraft | null {
  const raw = storage.getItem(WORKOUT_DRAFT_STORAGE_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const draft = isRecord(parsed) && isRecord(parsed.state) ? parsed.state.draft : null;
  return isWorkoutDraft(draft) ? draft : null;
}

function resolveTemplate(input: SeedProgramInput): ProgramTemplate {
  if (input.presetId !== undefined) {
    const preset = getPresetById(input.presetId);
    if (preset === undefined) throw new Error(`seedProgram: unknown preset id "${input.presetId}"`);
    return preset;
  }
  if (input.template !== undefined) return input.template;
  throw new Error('seedProgram: pass presetId or template');
}

function emptyBackup(exportedAt: string): BackupV3 {
  return {
    format: 'tytax-backup',
    version: 3,
    exportedAt,
    profiles: [],
    workoutLogs: [],
    programs: [],
    prRecords: [],
    bodyweightEntries: [],
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  };
}

/** The hooks this app installs: the contract with every optional profile method present (G2-01). */
export type AppE2EHooks = E2EHooks & Required<Pick<E2EHooks, 'setActiveProfile' | 'removeProfile' | 'listProfiles'>>;

export function createE2EHooks(repo: Repository, options: E2EHooksOptions): AppE2EHooks {
  const storage = options.storage ?? (() => window.localStorage);
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  return {
    ready: true,
    sha: process.env.NEXT_PUBLIC_GIT_SHA ?? 'unknown',

    async reset() {
      await repo.resetAll();
      storage().removeItem(WORKOUT_DRAFT_STORAGE_KEY);
      await repo.profiles.ensureActive(options.defaultProfileName);
    },

    async seedProfile(input) {
      const profile = await repo.profiles.create({ name: input?.name ?? 'Test', settings: input?.settings });
      if (input?.activate !== false) await repo.profiles.setActive(profile.id);
      return profile;
    },

    async seedHistory(profileId, logs) {
      const stamp = now();
      const built = logs.map((l) => buildWorkoutLog(profileId, l, stamp, newId));
      await repo.importBackup({ ...emptyBackup(stamp.toISOString()), workoutLogs: built });
      return built;
    },

    async seedProgram(profileId, input) {
      return repo.programs.create(profileId, resolveTemplate(input), { activate: input.activate ?? true });
    },

    listLogs(profileId) {
      return repo.logs.list(profileId);
    },

    async snapshot() {
      return {
        activeProfileId: await repo.profiles.getActiveId(),
        draft: readPersistedDraft(storage()),
      };
    },

    setActiveProfile(profileId) {
      return repo.profiles.setActive(profileId);
    },

    removeProfile(profileId) {
      return repo.profiles.remove(profileId);
    },

    listProfiles() {
      return repo.profiles.list();
    },
  };
}

/**
 * What AppBootstrap installs: the contract hooks plus boot state. `ready` is
 * false until the app finished booting; `bootError` is set when it failed, so
 * e2e waits can fail with the real error while `reset()` stays usable.
 * docs/v2/requests/G5-07.md asks for `ready: boolean` + `bootError?` in the
 * `E2EHooks` contract; until then the window assignment below narrows the type.
 */
export interface E2EBootHooks extends Omit<AppE2EHooks, 'ready'> {
  ready: boolean;
  bootError?: string;
}

/** Installs the hooks on `window.__tytaxE2E` with `ready: false`; the caller flips it. */
export function installBootingE2EHooks(repo: Repository, options: E2EHooksOptions): E2EBootHooks {
  const hooks: E2EBootHooks = { ...createE2EHooks(repo, options), ready: false };
  window.__tytaxE2E = hooks as E2EHooks;
  return hooks;
}

/** Installs the hooks on `window.__tytaxE2E` and returns them. */
export function installE2EHooks(repo: Repository, options: E2EHooksOptions): AppE2EHooks {
  const hooks = createE2EHooks(repo, options);
  window.__tytaxE2E = hooks;
  return hooks;
}
