import { DEFAULT_PROFILE_SETTINGS, type Profile, type ProfileSettings } from '@/contracts/domain';
import { RepoError, type CreateProfileInput, type ProfilesRepo } from '@/contracts/repo';
import {
  asc,
  assertNonEmpty,
  assertNonNegative,
  assertPositive,
  byProfile,
  compact,
  notFound,
  paginate,
  stripKeys,
  visible,
  type RepoContext,
  type WriteScope,
} from './context';
import { OWNED_TABLES, dataTable } from './tables';

export const ACTIVE_PROFILE_KEY = 'activeProfileId';

const UNITS = new Set(['kg', 'lb']);
const LANGUAGES = new Set(['hr', 'en']);
const WARMUPS = new Set(['standard', 'heavy', 'pyramid', 'none']);
const THEMES = new Set(['tactical', 'oled']);

function validateSettings(s: ProfileSettings): void {
  if (!UNITS.has(s.units)) throw new RepoError('VALIDATION', 'settings.units must be kg or lb');
  if (!LANGUAGES.has(s.language)) throw new RepoError('VALIDATION', 'settings.language must be hr or en');
  if (!WARMUPS.has(s.warmupStrategy)) throw new RepoError('VALIDATION', 'settings.warmupStrategy is invalid');
  if (!THEMES.has(s.theme)) throw new RepoError('VALIDATION', 'settings.theme is invalid');
  assertNonNegative(s.restSeconds, 'settings.restSeconds');
  assertNonNegative(s.barWeightKg, 'settings.barWeightKg');
  if (!Array.isArray(s.plateSetKg)) throw new RepoError('VALIDATION', 'settings.plateSetKg must be an array');
  s.plateSetKg.forEach((p) => assertPositive(p, 'settings.plateSetKg[]'));
}

/** Defaults overlaid with `patch`; arrays are copied, never shared with DEFAULT_PROFILE_SETTINGS. */
export function mergeSettings(base: ProfileSettings, patch?: Partial<ProfileSettings>): ProfileSettings {
  const merged: ProfileSettings = { ...base, ...compact(patch ?? {}) };
  merged.plateSetKg = [...(merged.plateSetKg ?? DEFAULT_PROFILE_SETTINGS.plateSetKg)];
  validateSettings(merged);
  return merged;
}

export async function getLiveProfile(ctx: RepoContext, id: string): Promise<Profile> {
  const p = await ctx.db.profiles.get(id);
  if (!p || p.deletedAt) throw notFound('Profile', id);
  return p;
}

export async function putProfile(ctx: RepoContext, w: WriteScope, profile: Profile): Promise<Profile> {
  const next = compact({ ...profile, updatedAt: ctx.stamp() });
  await ctx.db.profiles.put(next);
  await w.queue('profiles', 'upsert', next.id, next.id);
  return next;
}

async function firstLiveProfile(ctx: RepoContext): Promise<Profile | undefined> {
  const all = await ctx.db.profiles.toArray();
  return all.filter((p) => !p.deletedAt).sort((a, b) => asc(a.createdAt, b.createdAt) || asc(a.id, b.id))[0];
}

async function readActiveId(ctx: RepoContext): Promise<string | null> {
  const row = await ctx.db.meta.get(ACTIVE_PROFILE_KEY);
  return typeof row?.value === 'string' ? row.value : null;
}

async function writeActiveId(ctx: RepoContext, id: string | null): Promise<void> {
  await ctx.db.meta.put({ key: ACTIVE_PROFILE_KEY, value: id });
}

export function createProfilesRepo(ctx: RepoContext): ProfilesRepo {
  async function createIn(w: WriteScope, input: CreateProfileInput): Promise<Profile> {
    assertNonEmpty(input?.name, 'name');
    const stamp = ctx.stamp();
    const profile: Profile = compact({
      id: ctx.newId(),
      name: input.name.trim(),
      accountId: input.accountId,
      avatarColor: input.avatarColor,
      activeProgramId: null,
      settings: mergeSettings({ ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg] }, input.settings),
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
        const clean = stripKeys(patch ?? {}, ['id', 'createdAt', 'settings', 'deletedAt']);
        if (clean.name !== undefined) {
          assertNonEmpty(clean.name, 'name');
          clean.name = clean.name.trim();
        }
        if (clean.bodyweightKg !== undefined) assertPositive(clean.bodyweightKg, 'bodyweightKg');
        return putProfile(ctx, w, { ...current, ...clean });
      }),

    updateSettings: (id, patch) =>
      ctx.write(async (w) => {
        const current = await getLiveProfile(ctx, id);
        return putProfile(ctx, w, { ...current, settings: mergeSettings(current.settings, patch) });
      }),

    remove: (id) =>
      ctx.write(async (w) => {
        const profile = await getLiveProfile(ctx, id);
        const soft = ctx.sync.enabled;
        const stamp = ctx.stamp();
        for (const [name, syncName] of OWNED_TABLES) {
          const table = dataTable(ctx.db, name);
          const rows = await byProfile(table, id);
          if (!soft) {
            await table.bulkDelete(rows.map((r) => r.id));
            continue;
          }
          for (const row of rows) {
            if (row.deletedAt) continue;
            await table.put({ ...row, deletedAt: stamp, updatedAt: stamp });
            await w.queue(syncName, 'delete', row.id, id);
          }
        }
        if (soft) {
          await ctx.db.profiles.put({ ...profile, deletedAt: stamp, updatedAt: stamp });
          await w.queue('profiles', 'delete', id, id);
        } else {
          await ctx.db.profiles.delete(id);
          const stale = await ctx.db.syncQueue.filter((op) => op.profileId === id).primaryKeys();
          await ctx.db.syncQueue.bulkDelete(stale);
        }
        if ((await readActiveId(ctx)) === id) {
          const next = await firstLiveProfile(ctx);
          await writeActiveId(ctx, next?.id ?? null);
        }
      }),

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
