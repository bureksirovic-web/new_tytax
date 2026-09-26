/**
 * Which v3 profile owns a v2 row.
 *
 * v2 reality (read from 69cea4e): the app never created `profiles` rows
 * itself; stores and pages wrote `profileId: 'local'` (programs, logs,
 * arsenal), presets used `'preset'`, `familyMembers.profileId` pointed at the
 * user profile, and a log could carry `familyMemberId`.
 *
 * Rule, first match wins:
 * 1. `familyMemberId` names a known family member -> that member's profile.
 * 2. `profileId` names a known profile (v2 user, v3 profile, family member) -> it.
 * 3. Anything else (`'local'`, `'preset'`, `''`, a deleted member) -> the
 *    primary profile: the first v2 user profile by id (Dexie `toArray()`
 *    order, what v2 settings showed), else the oldest v3 profile, else a
 *    profile synthesised on first use with `ctx.newId()` (a uuid, because
 *    `'local'` is not a valid Supabase id).
 */
import type { LegacyUserProfileV2, Profile } from '@/contracts';
import { byId } from './coerce';
import { isV3Profile } from './profile';
import type { LegacyFamilyMemberV2, MigrationCtx } from './types';

export interface OwnerResolver {
  resolve(profileId: string | undefined, familyMemberId?: string): string;
  /** The synthesised primary id, when one had to be created. */
  synthesizedId(): string | null;
  primaryIdOrNull(): string | null;
  readonly familyIds: ReadonlySet<string>;
}

function oldest(profiles: readonly Profile[]): Profile | undefined {
  return [...profiles].sort((a, b) => (a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : byId(a, b)))[0];
}

export function createOwnerResolver(
  profiles: ReadonlyArray<LegacyUserProfileV2 | Profile>,
  familyMembers: readonly LegacyFamilyMemberV2[],
  ctx: MigrationCtx,
): OwnerResolver {
  const users = profiles.filter((p): p is LegacyUserProfileV2 => !isV3Profile(p)).sort(byId);
  const v3 = profiles.filter(isV3Profile);
  const familyIds = new Set(familyMembers.map((m) => m.id));
  const known = new Set<string>([...profiles.map((p) => p.id), ...familyIds]);
  let primary: string | null = users[0]?.id ?? oldest(v3)?.id ?? null;
  let synthesized: string | null = null;

  function getPrimary(): string {
    if (primary === null) {
      synthesized = ctx.newId ? ctx.newId() : crypto.randomUUID();
      primary = synthesized;
    }
    return primary;
  }

  return {
    familyIds,
    resolve(profileId, familyMemberId) {
      if (familyMemberId !== undefined && familyIds.has(familyMemberId)) return familyMemberId;
      if (profileId !== undefined && known.has(profileId)) return profileId;
      return getPrimary();
    },
    synthesizedId: () => synthesized,
    primaryIdOrNull: () => primary,
  };
}
