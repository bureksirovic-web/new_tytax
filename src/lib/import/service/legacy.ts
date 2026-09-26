/**
 * importLegacy: legacy tytax-autonomous file -> repository, in ONE
 * repo.transaction (profiles created, rows written, PRs recomputed, active
 * program set). Any throw rolls every write back.
 *
 * Decisions:
 * - Parsing, option checks and catalog loading happen before the transaction
 *   (a Dexie transaction must not await non-IndexedDB work).
 * - Rows get deterministic ids from the mapper (uuid v5 over profile + legacy
 *   username + source key, so a second legacy user merged into the same
 *   profile gets its own rows). A row whose id already exists in the profile
 *   (live or soft-deleted) is skipped, never overwritten: re-importing the
 *   same file into the same profile changes nothing, and a user's later edits
 *   or deletions survive.
 * - Settings are applied only when the import creates the profile, and only
 *   the keys the legacy data has. An existing profile's settings are kept.
 * - activeProgramId is set to the imported plan only when the profile has
 *   none and that program is live.
 * - PRs: new logs are written un-annotated with no PR rows; repo.importBackup
 *   then re-derives the profile's whole live history in the same transaction
 *   (rebuildPRsFrom, src/lib/db/repo/prs.ts: the finishWorkout rules). No new
 *   log -> nothing written -> no recompute, all-zero counts. prRecords counts are the diff of
 *   the profile's PR rows before/after: inserted = new ids, updated = rows
 *   rewritten (tombstones included), skipped = live rows left untouched.
 * - Every row is schema-checked (assertValidBackup) before the write.
 */
import { RepoError, type BackupV3, type Profile, type Repository } from '@/contracts';
import { mapLegacyUser } from '../map';
import type { LegacyNameResolver } from '../map/types';
import { parseLegacyBackup } from '../parse-legacy';
import type { LegacyImportBundle, LegacyUserData } from '../types';
import { assertValidBackup } from './backup';
import { defaultResolver, tagWarnings } from './preview';
import { capUnresolved, capWarnings } from './cap';
import { prDiff } from './prs';
import type { ImportCounts, ImportLegacyOptions, ImportTarget, LegacyImportResult, LegacyUserResult } from './types';

const NO_PRS: ImportCounts = { inserted: 0, updated: 0, skipped: 0 };

interface Env {
  resolver: LegacyNameResolver;
  stamp: string;
  shared: LegacyImportBundle['shared']['settings'];
}

interface Selection {
  user: LegacyUserData;
  target: ImportTarget;
}

function select(bundle: LegacyImportBundle, users: ImportLegacyOptions['users']): Selection[] {
  if (users.length === 0) throw new RepoError('VALIDATION', 'Choose at least one legacy user to import');
  const seenUsers = new Set<string>();
  const seenProfiles = new Set<string>();
  return users.map(({ username, target }) => {
    const user = bundle.users.find((u) => u.username === username);
    if (!user) throw new RepoError('VALIDATION', `Legacy user "${username}" is not in the file`);
    if (seenUsers.has(username)) throw new RepoError('VALIDATION', `Legacy user "${username}" is listed twice`);
    seenUsers.add(username);
    if ('profileId' in target) {
      if (seenProfiles.has(target.profileId)) throw new RepoError('VALIDATION', `Two users target profile ${target.profileId}`);
      seenProfiles.add(target.profileId);
    }
    return { user, target };
  });
}

async function resolveProfile(repo: Repository, target: ImportTarget): Promise<{ profile: Profile; created: boolean }> {
  if ('createProfileName' in target) return { profile: await repo.profiles.create({ name: target.createProfileName }), created: true };
  const profile = await repo.profiles.get(target.profileId);
  if (!profile || profile.deletedAt) throw new RepoError('NOT_FOUND', `Profile ${target.profileId} not found`);
  return { profile, created: false };
}

/** New rows (id not yet in the profile) and the counts for the result. */
function split<T extends { id: string }>(mapped: readonly T[], existing: ReadonlyArray<{ id: string }>): { fresh: T[]; counts: ImportCounts } {
  const ids = new Set(existing.map((r) => r.id));
  const fresh = mapped.filter((r) => !ids.has(r.id));
  return { fresh, counts: { inserted: fresh.length, updated: 0, skipped: mapped.length - fresh.length } };
}

async function importUser(repo: Repository, { user, target }: Selection, env: Env) {
  const resolved = await resolveProfile(repo, target);
  let profile = resolved.profile;
  const mapped = mapLegacyUser(user, { profileId: profile.id, resolver: env.resolver, importedAt: env.stamp, sharedSettings: env.shared });
  const settingsApplied = resolved.created ? Object.keys(mapped.settings).sort() : [];
  if (settingsApplied.length > 0) profile = await repo.profiles.updateSettings(profile.id, mapped.settings);

  const existing = await repo.exportBackup(profile.id);
  const logs = split(mapped.logs, existing.workoutLogs);
  const bodyweight = split(mapped.bodyweight, existing.bodyweightEntries);
  const programs = split(mapped.programs, existing.programs);

  const backup: BackupV3 = {
    format: 'tytax-backup',
    version: 3,
    exportedAt: env.stamp,
    profiles: [profile],
    workoutLogs: logs.fresh,
    programs: programs.fresh,
    prRecords: [],
    bodyweightEntries: bodyweight.fresh,
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  };
  assertValidBackup(backup);
  // The profile row is only there for the reference check; it is not rewritten.
  await repo.importBackup({ ...backup, profiles: [] });
  const prRecords = logs.fresh.length > 0 ? prDiff(existing.prRecords, (await repo.exportBackup(profile.id)).prRecords) : NO_PRS;

  const plan = mapped.activeProgramId;
  const planLive = plan !== null && (await repo.programs.get(profile.id, plan)) !== undefined;
  const activatedProgramId = profile.activeProgramId === null && planLive ? plan : null;
  if (activatedProgramId !== null) await repo.programs.setActive(profile.id, activatedProgramId);

  const result: LegacyUserResult = {
    username: user.username,
    profileId: profile.id,
    createdProfile: resolved.created,
    logs: logs.counts,
    bodyweight: bodyweight.counts,
    programs: programs.counts,
    prRecords,
    activatedProgramId,
    settingsApplied,
  };
  return { result, mapped };
}

/**
 * @throws ImportError (unusable file or an invalid record), RepoError
 * (VALIDATION for bad options, NOT_FOUND for a missing target profile), or
 * whatever the resolver throws. Nothing is written in any of these cases.
 */
export async function importLegacy(repo: Repository, input: unknown, opts: ImportLegacyOptions): Promise<LegacyImportResult> {
  const bundle = parseLegacyBackup(input);
  const selections = select(bundle, opts.users);
  const env: Env = {
    resolver: opts.resolver ?? (await defaultResolver()),
    stamp: (opts.now ?? (() => new Date().toISOString()))(),
    shared: bundle.shared.settings,
  };
  return repo.transaction(async () => {
    const perUser: LegacyUserResult[] = [];
    const unresolved = new Map<string, number>();
    let warnings = capWarnings(tagWarnings(bundle.warnings));
    for (const selection of selections) {
      const { result, mapped } = await importUser(repo, selection, env);
      perUser.push(result);
      for (const u of mapped.unresolved) unresolved.set(u.legacyName, (unresolved.get(u.legacyName) ?? 0) + u.occurrences);
      // Capped per user before merging: no huge spread into push, no 63 MiB result.
      warnings = warnings.concat(capWarnings(tagWarnings(mapped.warnings, result.username)));
    }
    const merged = [...unresolved.entries()]
      .map(([legacyName, occurrences]) => ({ legacyName, occurrences }))
      .sort((a, b) => (a.legacyName < b.legacyName ? -1 : a.legacyName > b.legacyName ? 1 : 0));
    return { perUser, unresolved: capUnresolved(merged), unresolvedCount: merged.length, warnings };
  });
}
