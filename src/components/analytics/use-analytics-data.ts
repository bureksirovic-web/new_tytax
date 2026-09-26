'use client';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { BodyweightEntry, ProfileSettings, Units, WorkoutLog } from '@/contracts/domain';
import { isRepoError, type Repository } from '@/contracts/repo';
import type { ExerciseLookup } from '@/contracts/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { localDay } from './analytics-dates';

/** Local calendar day (`'YYYY-MM-DD'`) `days` days before `now`. */
export function localDayDaysAgo(days: number, now: Date = new Date()): string {
  return localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

/** Clock for one mounted screen: fixed per mount so memoised maths does not churn. */
function useNow(): Date {
  const [now] = useState(() => new Date());
  return now;
}

export interface ExerciseNames {
  lookup: ExerciseLookup | undefined;
  /** Catalog name, else the log's snapshot name, else the id. */
  nameOf: (id: string, fallback?: string) => string;
  catalogLoading: boolean;
  /** True when the catalog is loaded (or failed) and has no entry for `id`. */
  isUnknown: (id: string) => boolean;
}

export function useExerciseNames(): ExerciseNames {
  const { catalog, loading, error } = useCatalog();
  const lookup = useMemo<ExerciseLookup | undefined>(() => (catalog ? (id) => catalog.getById(id) : undefined), [catalog]);
  const nameOf = useCallback((id: string, fallback?: string) => catalog?.getById(id)?.name ?? fallback ?? id, [catalog]);
  const isUnknown = useCallback((id: string) => !loading && (Boolean(error) || !catalog?.getById(id)), [catalog, loading, error]);
  return { lookup, nameOf, catalogLoading: loading, isUnknown };
}

export interface AnalyticsData {
  loading: boolean;
  profileId: string | undefined;
  units: Units;
  /** The active profile's live logs, whole history, newest first. */
  logs: WorkoutLog[];
  /** Exercise lookup from the lazy catalog; undefined while it loads (sections fall back to log snapshots). */
  lookup: ExerciseLookup;
  nameOf: ExerciseNames['nameOf'];
  catalogLoading: boolean;
  now: Date;
}

const EMPTY_LOOKUP: ExerciseLookup = () => undefined;

/** Everything the analytics screen reads: profile, units, logs (repository) and names (lazy catalog). */
export function useAnalyticsData(): AnalyticsData {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data: logs } = useRepoQuery(
    async (repo: Repository) => (profileId ? repo.logs.list(profileId) : []),
    [profileId],
  );
  const { lookup, nameOf, catalogLoading } = useExerciseNames();
  const now = useNow();
  return {
    loading: profileLoading || (profileId !== undefined && logs === undefined),
    profileId,
    units: profile?.settings.units ?? 'kg',
    logs: logs ?? [],
    lookup: lookup ?? EMPTY_LOOKUP,
    nameOf,
    catalogLoading,
    now,
  };
}

/** Live logs containing `exerciseId`, newest first, for the active profile. */
export function useExerciseHistory(exerciseId: string) {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data } = useRepoQuery(
    async (repo: Repository) => (profileId ? repo.logs.historyFor(profileId, exerciseId) : []),
    [profileId, exerciseId],
  );
  return {
    logs: data ?? [],
    units: (profile?.settings.units ?? 'kg') as Units,
    loading: profileLoading || (profileId !== undefined && data === undefined),
  };
}

/** Bodyweight entries of the active profile, newest first. */
export function useBodyweightEntries(profileId: string | undefined) {
  const { data } = useRepoQuery(
    async (repo: Repository): Promise<BodyweightEntry[]> => (profileId ? repo.bodyweight.list(profileId) : []),
    [profileId],
  );
  return { entries: data ?? [], loading: data === undefined };
}

// ─── Pinned exercises ────────────────────────────────────────────────────────

export const MAX_PINNED = 4;

/**
 * Pins are stored per profile. The contract field `settings.pinnedExerciseIds`
 * is only requested (docs/v2/requests/G4-30-pinned-exercises.md) and the
 * repository may reject unknown settings keys, so the interim store is
 * localStorage under `pinsStorageKey(profileId)`. When a profile's settings
 * already carry a `pinnedExerciseIds` array (the future contract) that wins.
 */
export type SettingsWithPins = ProfileSettings & { pinnedExerciseIds?: string[] };

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

/** Pins kept in localStorage for `profileId` (validated; [] when absent, corrupt or unavailable). */
export function readStoredPins(profileId: string): string[] {
  return parseStored(readStoredRaw(profileId));
}

const pinListeners = new Set<() => void>();

function writeStoredPins(profileId: string, ids: readonly string[]): void {
  try {
    storage()?.setItem(pinsStorageKey(profileId), JSON.stringify(ids));
  } catch {
    // quota / blocked storage: pins then live only as long as settings can hold them
  }
  pinListeners.forEach((notify) => notify());
}

/** Settings array (future contract) when present, else localStorage for `profileId`, else []. */
export function readPins(settings: ProfileSettings | undefined, profileId?: string): string[] {
  const fromSettings = (settings as SettingsWithPins | undefined)?.pinnedExerciseIds;
  if (Array.isArray(fromSettings)) return sanitizePins(fromSettings);
  return profileId ? readStoredPins(profileId) : [];
}

/**
 * Writes localStorage always; also offers the ids to settings, where a
 * VALIDATION rejection (unknown key before G4-30 lands) is expected and ignored.
 */
export async function savePins(repo: Repository, profileId: string, ids: readonly string[]): Promise<void> {
  const unique = sanitizePins(ids);
  writeStoredPins(profileId, unique);
  try {
    await repo.profiles.updateSettings(profileId, { pinnedExerciseIds: unique } as Partial<SettingsWithPins>);
  } catch (e) {
    if (!isRepoError(e, 'VALIDATION')) throw e;
  }
}

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
  const { profile, profileId } = useActiveProfile();
  const stored = useSyncExternalStore(
    subscribePins,
    () => (profileId ? readStoredRaw(profileId) : null),
    () => null,
  );
  const pins = useMemo(() => {
    const fromSettings = (profile?.settings as SettingsWithPins | undefined)?.pinnedExerciseIds;
    return Array.isArray(fromSettings) ? sanitizePins(fromSettings) : parseStored(stored);
  }, [profile?.settings, stored]);
  return { pins, profileId };
}
