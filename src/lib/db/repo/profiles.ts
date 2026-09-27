import type { Profile } from '@/contracts/domain';
import { RepoError, type CreateProfileInput, type ProfilesRepo } from '@/contracts/repo';
import type { RepoContext, WriteScope } from './context';
import { removeProfile } from './profile-remove';
import { firstLiveProfile, getLiveProfile, putProfile, readActiveId, writeActiveId } from './profile-store';
import { asc, compact, paginate, stripKeys, visible } from './rows';
import { defaultSettings, mergeSettings } from './settings';
import { assertBirthYear, assertNonEmpty, assertPositive, notFound } from './validate';

export { ACTIVE_PROFILE_KEY, getLiveProfile, putProfile } from './profile-store';
export { mergeSettings } from './settings';

type ProfilePatch = Parameters<ProfilesRepo['update']>[1];

const GENDERS: ReadonlySet<string> = new Set(['male', 'female', 'other']);
const LEVELS: ReadonlySet<string> = new Set(['beginner', 'intermediate', 'advanced']);

function assertOptionalString(v: unknown, field: string): void {
  if (v !== undefined && typeof v !== 'string') throw new RepoError('VALIDATION', `${field} must be a string`);
}

function assertOneOf(v: unknown, allowed: ReadonlySet<string>, field: string): void {
  if (v !== undefined && (typeof v !== 'string' || !allowed.has(v))) {
    throw new RepoError('VALIDATION', `${field} must be one of ${[...allowed].join(', ')}`);
  }
}

/** Validates and normalises a profile patch; `activeProgramId` must be one of this profile's live programs. */
async function cleanPatch(ctx: RepoContext, id: string, patch: ProfilePatch): Promise<ProfilePatch> {
  const clean = stripKeys(patch ?? {}, ['id', 'createdAt', 'settings', 'deletedAt', 'updatedAt']);
  if (clean.name !== undefined) {
    assertNonEmpty(clean.name, 'name');
    clean.name = clean.name.trim();
  }
  if (clean.bodyweightKg !== undefined) assertPositive(clean.bodyweightKg, 'bodyweightKg');
  if (clean.birthYear !== undefined) assertBirthYear(clean.birthYear, 'birthYear', ctx.now());
  assertOneOf(clean.gender, GENDERS, 'gender');
  assertOneOf(clean.experienceLevel, LEVELS, 'experienceLevel');
  assertOptionalString(clean.avatarColor, 'avatarColor');
  assertOptionalString(clean.accountId, 'accountId');
  const programId = clean.activeProgramId;
  if (programId !== undefined && programId !== null) {
    const program = typeof programId === 'string' ? await ctx.db.programs.get(programId) : undefined;
    if (!program || program.profileId !== id || program.deletedAt) throw notFound('Program', String(programId));
  }
  return clean;
}

export function createProfilesRepo(ctx: RepoContext): ProfilesRepo {
  async function createIn(w: WriteScope, input: CreateProfileInput): Promise<Profile> {
    assertNonEmpty(input?.name, 'name');
    assertOptionalString(input.avatarColor, 'avatarColor');
    assertOptionalString(input.accountId, 'accountId');
    if (input.birthYear !== undefined) assertBirthYear(input.birthYear, 'birthYear', ctx.now());
    assertOneOf(input.experienceLevel, LEVELS, 'experienceLevel');
    const stamp = ctx.stamp();
    const profile: Profile = compact({
      id: ctx.newId(),
      name: input.name.trim(),
      accountId: input.accountId,
      avatarColor: input.avatarColor,
      activeProgramId: null,
      settings: mergeSettings(defaultSettings(), input.settings),
      birthYear: input.birthYear,
      experienceLevel: input.experienceLevel,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await ctx.db.profiles.add(profile);
    await w.queue('profiles', 'upsert', profile.id, profile.id);
    return profile;
  }

  return {
    async list(opts) {
      const rows = visible(await ctx.db.profiles.toArray(), opts?.includeDeleted);
      rows.sort((a, b) => asc(a.createdAt, b.createdAt) || asc(a.id, b.id));
      return paginate(rows, opts);
    },

    async get(id) {
      const p = await ctx.db.profiles.get(id);
      return p && !p.deletedAt ? p : undefined;
    },

    create: (input) => ctx.write((w) => createIn(w, input)),

    update: (id, patch) =>
      ctx.write(async (w) => {
        const current = await getLiveProfile(ctx, id);
        const clean = await cleanPatch(ctx, id, patch);
        return putProfile(ctx, w, { ...current, ...clean });
      }),

    updateSettings: (id, patch) =>
      ctx.write(async (w) => {
        const current = await getLiveProfile(ctx, id);
        return putProfile(ctx, w, { ...current, settings: mergeSettings(current.settings, patch) });
      }),

    remove: (id) => ctx.write((w) => removeProfile(ctx, w, id)),

    async getActiveId() {
      const id = await readActiveId(ctx);
      if (!id) return null;
      const p = await ctx.db.profiles.get(id);
      return p && !p.deletedAt ? id : null;
    },

    setActive: (id) =>
      ctx.write(async () => {
        await getLiveProfile(ctx, id);
        await writeActiveId(ctx, id);
      }),

    ensureActive: (defaultName) =>
      ctx.write(async (w) => {
        const activeId = await readActiveId(ctx);
        const active = activeId ? await ctx.db.profiles.get(activeId) : undefined;
        if (active && !active.deletedAt) return active;
        const chosen = (await firstLiveProfile(ctx)) ?? (await createIn(w, { name: defaultName }));
        await writeActiveId(ctx, chosen.id);
        return chosen;
      }),
  };
}
