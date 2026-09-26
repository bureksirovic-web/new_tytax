import { getDb } from '@/lib/db';

/**
 * The automatic pre-migration export (G2: `getPreMigrationExport` /
 * `clearPreMigrationExport` in `@/lib/db/migrations`). Branch v2-g4 has an
 * older migrations module without them; the typeof checks make the settings
 * panel stay hidden there and appear once G2's module is merged.
 */
export interface PreMigrationApi {
  /** The stored export, or null when there is none (fresh install, or already cleared). */
  get(): Promise<{ exportedAt: string } | null>;
  clear(): Promise<void>;
}

type MetaFn = (db: unknown) => Promise<unknown>;

const isExport = (v: unknown): v is { exportedAt: string } =>
  typeof v === 'object' && v !== null && typeof (v as { exportedAt?: unknown }).exportedAt === 'string';

/** Wraps a migrations module; null when it lacks either function (the database is opened only if both exist). */
export function preMigrationApiFrom(mod: Record<string, unknown>, openDb: () => unknown): PreMigrationApi | null {
  const { getPreMigrationExport: get, clearPreMigrationExport: clear } = mod;
  if (typeof get !== 'function' || typeof clear !== 'function') return null;
  const db = openDb();
  return {
    get: async () => {
      const value = await (get as MetaFn)(db);
      return isExport(value) ? value : null;
    },
    clear: async () => {
      await (clear as MetaFn)(db);
    },
  };
}

export async function loadPreMigrationApi(): Promise<PreMigrationApi | null> {
  try {
    const mod = (await import('@/lib/db/migrations')) as unknown as Record<string, unknown>;
    return preMigrationApiFrom(mod, getDb);
  } catch (error: unknown) {
    console.error('[settings] migrations module failed to load', error);
    return null;
  }
}

/** `tytax_before_update_<YYYY-MM-DD>.json` from the export's own timestamp. */
export function preMigrationFilename(exportedAt: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? 'backup';
  return `tytax_before_update_${day}.json`;
}
