/**
 * Low-level profile rows and the device-level active-profile pointer
 * (`meta.activeProfileId`). Shared by the profiles, programs and records repos.
 */
import type { Profile } from '@/contracts/domain';
import type { RepoContext, WriteScope } from './context';
import { asc, compact } from './rows';
import { notFound } from './validate';

export const ACTIVE_PROFILE_KEY = 'activeProfileId';

export async function getLiveProfile(ctx: RepoContext, id: string): Promise<Profile> {
  const p = typeof id === 'string' && id !== '' ? await ctx.db.profiles.get(id) : undefined;
  if (!p || p.deletedAt) throw notFound('Profile', String(id));
  return p;
}

export async function putProfile(ctx: RepoContext, w: WriteScope, profile: Profile): Promise<Profile> {
  const next = compact({ ...profile, updatedAt: ctx.stamp() });
  await ctx.db.profiles.put(next);
  await w.queue('profiles', 'upsert', next.id, next.id);
  return next;
}

/** Oldest live profile (createdAt, then id), the fallback when the active one goes away. */
export async function firstLiveProfile(ctx: RepoContext): Promise<Profile | undefined> {
  const all = await ctx.db.profiles.toArray();
  return all.filter((p) => !p.deletedAt).sort((a, b) => asc(a.createdAt, b.createdAt) || asc(a.id, b.id))[0];
}

export async function readActiveId(ctx: RepoContext): Promise<string | null> {
  const row = await ctx.db.meta.get(ACTIVE_PROFILE_KEY);
  return typeof row?.value === 'string' ? row.value : null;
}

export async function writeActiveId(ctx: RepoContext, id: string | null): Promise<void> {
  await ctx.db.meta.put({ key: ACTIVE_PROFILE_KEY, value: id });
}
