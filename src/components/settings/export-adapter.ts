import type { BodyweightEntry, WorkoutLog } from '@/contracts/domain';
import type { LegacyImportApi } from './legacy-import-api';

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
 * Legacy (tytax-autonomous) import through G2's service. `@/lib/import` does
 * not exist in branch v2-g4 and importing a missing module breaks the build,
 * so this returns null here (the UI shows a disabled control). At integration
 * (request G4-35) the body becomes:
 * `const mod = await import('@/lib/import'); return { preview: mod.previewLegacyImport, run: mod.importLegacy };`
 */
export async function loadLegacyImportApi(): Promise<LegacyImportApi | null> {
  return null;
}

export function csvFilename(kind: 'workouts' | 'bodyweight', day: string): string {
  return `tytax_${kind}_${day}.csv`;
}
