/** Dry run of the legacy import: parse + map, no database access. */
import { mapLegacyUser } from '../map';
import type { LegacyNameResolver, MapWarning } from '../map/types';
import { parseLegacyBackup } from '../parse-legacy';
import type { ImportWarning } from '../types';
import { capUnresolved, capWarnings } from './cap';
import type { LegacyImportPreview, PreviewOptions, ServiceWarning } from './types';

/** Profile id the preview maps under; never written anywhere. */
const PREVIEW_PROFILE = 'preview';
const PREVIEW_STAMP = '1970-01-01T00:00:00.000Z';

/** The real catalog, loaded lazily so this module stays out of first-load JS. */
export async function defaultResolver(): Promise<LegacyNameResolver> {
  const { catalog } = await import('@/lib/catalog');
  return catalog.loadCatalog();
}

export function tagWarnings(warnings: ReadonlyArray<ImportWarning | MapWarning>, username?: string): ServiceWarning[] {
  return warnings.map((w) => (username === undefined ? { ...w } : { username, ...w }));
}

/**
 * @param input JSON text of the legacy file, or an already-parsed value.
 * @throws ImportError when the file as a whole is unusable.
 */
export async function previewLegacyImport(input: unknown, opts: PreviewOptions = {}): Promise<LegacyImportPreview> {
  const bundle = parseLegacyBackup(input);
  const resolver = opts.resolver ?? (await defaultResolver());
  const users = bundle.users.map((user) => {
    const mapped = mapLegacyUser(user, {
      profileId: PREVIEW_PROFILE,
      resolver,
      importedAt: PREVIEW_STAMP,
      sharedSettings: bundle.shared.settings,
    });
    return {
      username: user.username,
      logs: mapped.logs.length,
      sets: mapped.logs.reduce((n, l) => n + l.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
      bodyweight: mapped.bodyweight.length,
      programs: mapped.programs.length,
      unresolved: capUnresolved(mapped.unresolved),
      unresolvedCount: mapped.unresolved.length,
      warnings: capWarnings(tagWarnings(mapped.warnings, user.username)),
    };
  });
  return { format: bundle.format, users, warnings: capWarnings(tagWarnings(bundle.warnings)) };
}
