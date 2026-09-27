/**
 * Dexie v2 -> v3 profile transforms (pure).
 *
 * v2 had one `UserProfile` per device (settings on it) plus `familyMembers`
 * that carried no settings. v3 makes each of them a `Profile`; a family member
 * keeps its v2 id and inherits its owner's settings.
 */
import {
  DEFAULT_PROFILE_SETTINGS,
  type LegacyUserProfileV2,
  type Profile,
  type ProfileSettings,
  type WarmupStrategy,
} from '@/contracts';
import { compact, strOr } from './coerce';
import type { LegacyDeviceSettings, LegacyFamilyMemberV2 } from './types';

const EPOCH = '1970-01-01T00:00:00.000Z';
const WARMUPS: readonly WarmupStrategy[] = ['standard', 'heavy', 'pyramid', 'none'];

export function isV3Profile(p: LegacyUserProfileV2 | Profile): p is Profile {
  return 'settings' in p && typeof p.settings === 'object' && p.settings !== null;
}

export interface ProfileMigrationOptions {
  /** Plates from the v2 equipment profile, any order. Empty or absent: default set. */
  plateWeights?: readonly number[];
  /** Fallback when the v2 row has no timestamps. Default: the Unix epoch. */
  now?: string;
  /** v2 localStorage settings; fill values the v2 row lacks. */
  device?: LegacyDeviceSettings;
}

/** Contract defaults overlaid with the v2 device settings that are present. */
export function baseSettings(device: LegacyDeviceSettings | undefined, plateWeights?: readonly number[]): ProfileSettings {
  const d = DEFAULT_PROFILE_SETTINGS;
  return {
    ...d,
    units: device?.units ?? d.units,
    language: device?.language ?? d.language,
    theme: device?.theme ?? d.theme,
    plateSetKg: plateSet(plateWeights),
  };
}

export function plateSet(weights: readonly number[] | undefined): number[] {
  // An untyped v2 row may hold a string ('20,10,5') or an object here.
  const valid = (Array.isArray(weights) ? (weights as readonly unknown[]) : []).filter(
    (w): w is number => typeof w === 'number' && Number.isFinite(w) && w > 0,
  );
  if (valid.length === 0) return [...DEFAULT_PROFILE_SETTINGS.plateSetKg];
  return [...new Set(valid)].sort((a, b) => b - a);
}

/** v2 row settings merged over the device settings, then `DEFAULT_PROFILE_SETTINGS`. */
export function settingsFromV2(user: LegacyUserProfileV2, opts: ProfileMigrationOptions = {}): ProfileSettings {
  const d = baseSettings(opts.device);
  const bar = user.barWeightKg;
  const units = user.unitSystem === 'imperial' ? 'lb' : user.unitSystem === 'metric' ? 'kg' : d.units;
  return {
    ...d,
    units,
    language: user.language === 'en' || user.language === 'hr' ? user.language : d.language,
    theme: user.theme === 'oled' || user.theme === 'tactical' ? user.theme : d.theme,
    warmupStrategy: WARMUPS.includes(user.warmupStrategy) ? user.warmupStrategy : d.warmupStrategy,
    barWeightKg: typeof bar === 'number' && Number.isFinite(bar) && bar >= 0 ? bar : d.barWeightKg,
    plateSetKg: plateSet(opts.plateWeights),
  };
}

/**
 * v2 user profile -> v3 profile. A v3 profile is returned unchanged.
 * A signed-in v2 profile (`isAnonymous: false`) had the Supabase auth uid as
 * its id, which becomes `accountId`.
 */
export function migrateProfileV2(
  user: LegacyUserProfileV2 | Profile,
  activeProgramId: string | null,
  opts: ProfileMigrationOptions = {},
): Profile {
  if (isV3Profile(user)) return user;
  const createdAt = strOr(user.createdAt, strOr(user.updatedAt, opts.now ?? EPOCH));
  return compact<Profile>({
    id: user.id,
    name: strOr(user.displayName, 'Profile'),
    accountId: user.isAnonymous === false ? user.id : undefined,
    activeProgramId,
    settings: settingsFromV2(user, opts),
    bodyweightKg: user.bodyweightKg,
    gender: user.gender,
    experienceLevel: user.experienceLevel,
    createdAt,
    updatedAt: strOr(user.updatedAt, createdAt),
  });
}

/** v2 family member -> v3 profile with a copy of the owner's settings. */
export function migrateFamilyMemberV2(
  member: LegacyFamilyMemberV2,
  ownerSettings: ProfileSettings,
  activeProgramId: string | null,
): Profile {
  return compact<Profile>({
    id: member.id,
    name: strOr(member.name, 'Profile'),
    activeProgramId,
    settings: { ...ownerSettings, plateSetKg: [...ownerSettings.plateSetKg] },
    bodyweightKg: member.bodyweightKg,
    gender: member.gender,
    experienceLevel: member.experienceLevel,
    createdAt: member.createdAt,
    updatedAt: member.createdAt,
  });
}

/** A fresh profile for data that v2 stored under `'local'` with no profile row. */
export function synthesizeProfile(
  id: string,
  name: string,
  now: string,
  activeProgramId: string | null,
  plateWeights?: readonly number[],
  device?: LegacyDeviceSettings,
): Profile {
  return {
    id,
    name,
    activeProgramId,
    settings: baseSettings(device, plateWeights),
    createdAt: now,
    updatedAt: now,
  };
}
