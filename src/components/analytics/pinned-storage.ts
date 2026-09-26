'use client';
/** Pinned exercises (analytics + dashboard): `ProfileSettings.pinnedExerciseIds`, localStorage only as fallback. */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ProfileSettings } from '@/contracts/domain';
import { isRepoError, type Repository } from '@/contracts/repo';
import { useActiveProfile, useRepo } from '@/hooks/use-repo';

export const MAX_PINNED = 4;

/**
 * Pins live in the contract field `settings.pinnedExerciseIds` (G4-30). A
 * repository that still rejects the key (`RepoError('VALIDATION')`, G2's Wave 1
 * settings whitelist) makes localStorage under `pinsStorageKey(profileId)` the
 * fallback store. Pins found there are copied into settings once the repository
 * accepts them, then the local key is removed. Kept as an alias for callers.
 */
export type SettingsWithPins = ProfileSettings;

const PINS_KEY_PREFIX = 'tytax.analytics.pinned.';

export function pinsStorageKey(profileId: string): string {
  return `${PINS_KEY_PREFIX}${profileId}`;
}

/** Only non-empty strings, first occurrence kept, at most MAX_PINNED. */
export function sanitizePins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return [...new Set(ids)].slice(0, MAX_PINNED);
}

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined; // access can throw (blocked site data)
  }
}

function readStoredRaw(profileId: string): string | null {
  try {
    return storage()?.getItem(pinsStorageKey(profileId)) ?? null;
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    return sanitizePins(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Pins kept in the localStorage fallback for `profileId` (validated; [] when absent, corrupt or unavailable). */
export function readStoredPins(profileId: string): string[] {
  return parseStored(readStoredRaw(profileId));
}

const pinListeners = new Set<() => void>();
const notifyAll = () => pinListeners.forEach((notify) => notify());

function writeStoredPins(profileId: string, ids: readonly string[]): void {
  try {
    storage()?.setItem(pinsStorageKey(profileId), JSON.stringify(ids));
  } catch {
    // quota / blocked storage: nothing else can hold them on this repository
  }
  notifyAll();
}

function clearStoredPins(profileId: string): void {
  if (readStoredRaw(profileId) === null) return;
  try {
    storage()?.removeItem(pinsStorageKey(profileId));
  } catch {
    // blocked storage: settings win on read anyway
  }
  notifyAll();
}

function settingsPins(settings: ProfileSettings | undefined): string[] | undefined {
  const ids = settings?.pinnedExerciseIds;
  return Array.isArray(ids) ? sanitizePins(ids) : undefined;
}

/** `settings.pinnedExerciseIds` when it is an array (even empty), else the localStorage fallback, else []. */
export function readPins(settings: ProfileSettings | undefined, profileId?: string): string[] {
  return settingsPins(settings) ?? (profileId ? readStoredPins(profileId) : []);
}

/**
 * Saves to settings. On a VALIDATION rejection (repository without the key)
 * the pins go to localStorage instead; any other repository error surfaces.
 * After an accepted save the local fallback key is removed.
 */
export async function savePins(repo: Repository, profileId: string, ids: readonly string[]): Promise<void> {
  const unique = sanitizePins(ids);
  try {
    await repo.profiles.updateSettings(profileId, { pinnedExerciseIds: unique });
  } catch (e) {
    if (!isRepoError(e, 'VALIDATION')) throw e;
    writeStoredPins(profileId, unique);
    return;
  }
  clearStoredPins(profileId);
}

export type PinMigration = 'migrated' | 'kept' | 'none';

/**
 * One-time move of localStorage pins into settings. 'none': nothing stored, or
 * settings already hold an array (the stale local key is then removed).
 * 'kept': the repository refused (pins stay local). Never throws.
 */
export async function migrateStoredPins(repo: Repository, profileId: string, settings: ProfileSettings | undefined): Promise<PinMigration> {
  if (settingsPins(settings)) {
    clearStoredPins(profileId);
    return 'none';
  }
  const stored = readStoredPins(profileId);
  if (stored.length === 0) return 'none';
  try {
    await repo.profiles.updateSettings(profileId, { pinnedExerciseIds: stored });
  } catch {
    return 'kept';
  }
  clearStoredPins(profileId);
  return 'migrated';
}

/** profileId → stored value already offered to settings, so a refusing repository is asked once per value. */
const migrationTried = new Map<string, string | null>();

function subscribePins(notify: () => void): () => void {
  pinListeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PINS_KEY_PREFIX)) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    pinListeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePinnedExercises(): { pins: string[]; profileId: string | undefined } {
  const repo = useRepo();
  const { profile, profileId } = useActiveProfile();
  const stored = useSyncExternalStore(
    subscribePins,
    () => (profileId ? readStoredRaw(profileId) : null),
    () => null,
  );
  const settings = profile?.settings;
  const pins = useMemo(() => settingsPins(settings) ?? parseStored(stored), [settings, stored]);

  useEffect(() => {
    if (!profileId || !settings || stored === null) return;
    if (migrationTried.has(profileId) && migrationTried.get(profileId) === stored) return;
    migrationTried.set(profileId, stored);
    void migrateStoredPins(repo, profileId, settings);
  }, [repo, profileId, settings, stored]);

  return { pins, profileId };
}
