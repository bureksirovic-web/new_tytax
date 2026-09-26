import type { BodyweightEntry, WorkoutLog } from '@/contracts/domain';

/**
 * Adapter over G2's `@/lib/export` and `@/lib/import`, loaded on demand so
 * neither lands in the settings first-load chunk. G2 is still building both
 * (see docs/v2/requests/G4-35-import-export-api.md): whatever is missing is
 * reported as unavailable and the UI shows a disabled control.
 */
export interface CsvApi {
  workouts?: (logs: WorkoutLog[]) => string;
  bodyweight?: (entries: BodyweightEntry[]) => string;
}

type Fn = (...args: never[]) => unknown;
const fn = (mod: Record<string, unknown>, ...names: string[]): Fn | undefined => {
  for (const name of names) {
    const v = mod[name];
    if (typeof v === 'function') return v as Fn;
  }
  return undefined;
};

export async function loadCsvApi(): Promise<CsvApi> {
  try {
    const mod = (await import('@/lib/export/csv')) as unknown as Record<string, unknown>;
    return {
      workouts: fn(mod, 'workoutLogsToCSV') as CsvApi['workouts'],
      bodyweight: fn(mod, 'bodyweightToCSV') as CsvApi['bodyweight'],
    };
  } catch (error: unknown) {
    console.error('[settings] CSV export module failed to load', error);
    return {};
  }
}

/**
 * Legacy (tytax-autonomous) import. `@/lib/import` does not exist in this
 * branch yet; importing a missing module would break the build, so this
 * reports "unavailable" until G2's entry points (request G4-35) land. Then:
 * `const mod = await import('@/lib/import'); return { parse: mod.parseLegacy, commit: mod.commitLegacyImport }`.
 */
export async function loadLegacyImportApi(): Promise<null> {
  return null;
}

export function csvFilename(kind: 'workouts' | 'bodyweight', day: string): string {
  return `tytax_${kind}_${day}.csv`;
}
