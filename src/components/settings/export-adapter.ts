import type { BodyweightEntry, Units, WorkoutLog } from '@/contracts/domain';
import type { LegacyImportApi } from './legacy-import-api';

/**
 * Adapter over G2's `@/lib/export` and `@/lib/import`, loaded on demand so
 * neither lands in the settings first-load chunk. G2 is still building both
 * (see docs/v2/requests/G4-35-import-export-api.md): whatever is missing is
 * reported as unavailable and the UI shows a disabled control.
 */
export interface CsvApi {
  workouts?: (logs: WorkoutLog[], opts?: { units?: Units }) => string;
  bodyweight?: (entries: BodyweightEntry[], opts?: { units?: Units }) => string;
  /** True only when a probe export in lb produced an lb header (`csvHonorsUnits`); the older module writes kg only. */
  unitsSupported?: boolean;
}

type Fn = (...args: never[]) => unknown;
const fn = (mod: Record<string, unknown>, ...names: string[]): Fn | undefined => {
  for (const name of names) {
    const v = mod[name];
    if (typeof v === 'function') return v as Fn;
  }
  return undefined;
};

/**
 * Whether `workouts` really writes the requested units: exports no rows in lb
 * and reads the header row it produced. Never inferred from other exports.
 */
export function csvHonorsUnits(workouts: CsvApi['workouts']): boolean {
  if (!workouts) return false;
  try {
    const header = workouts([], { units: 'lb' }).split(/\r?\n/, 1)[0] ?? '';
    return /\blbs?\b/i.test(header) && !/\bkg\b/i.test(header);
  } catch {
    return false;
  }
}

export async function loadCsvApi(): Promise<CsvApi> {
  try {
    const mod = (await import('@/lib/export/csv')) as unknown as Record<string, unknown>;
    const workouts = fn(mod, 'workoutLogsToCSV') as CsvApi['workouts'];
    return { workouts, bodyweight: fn(mod, 'bodyweightToCSV') as CsvApi['bodyweight'], unitsSupported: csvHonorsUnits(workouts) };
  } catch (error: unknown) {
    console.error('[settings] CSV export module failed to load', error);
    return {};
  }
}

/**
 * Legacy (tytax-autonomous) import through G2's service (`@/lib/import`),
 * loaded on demand. The assignment to `LegacyImportApi` makes tsc check that
 * G2's signatures still match the settings mirror (legacy-import-api.ts).
 */
export async function loadLegacyImportApi(): Promise<LegacyImportApi | null> {
  try {
    const mod = await import('@/lib/import');
    const api: LegacyImportApi = { preview: mod.previewLegacyImport, run: mod.importLegacy };
    return api;
  } catch (error: unknown) {
    console.error('[settings] legacy import module failed to load', error);
    return null;
  }
}

export function csvFilename(kind: 'workouts' | 'bodyweight', day: string): string {
  return `tytax_${kind}_${day}.csv`;
}
