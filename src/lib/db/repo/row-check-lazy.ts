/**
 * Lazy access to the BackupV3 per-row validator (`rowProblem`,
 * src/lib/import/backup-v3/row-check.ts). That module pulls in zod and the
 * whole BackupV3 schema (~48 kB gzip); importing it statically from the
 * repository put it into every route's first-load JS and pushed /dashboard
 * over the 250 kB budget (PLAN §10.2 AC8, `npm run check-bundle`). Only
 * `importBackup` and `applyRemote` need it, so they load it on first use.
 *
 * Both may run inside a caller's `repo.transaction` (the legacy import does),
 * where awaiting a network chunk would let IndexedDB auto-commit the
 * transaction. `Dexie.waitFor` keeps an active transaction alive while the
 * chunk loads (outside one it simply awaits); once loaded the validator is
 * cached and handed back as an already-resolved promise.
 */
import Dexie from 'dexie';
import type { rowProblem } from '@/lib/import/backup-v3/row-check';

export type RowProblemFn = typeof rowProblem;

let loaded: RowProblemFn | undefined;

export async function loadRowProblem(): Promise<RowProblemFn> {
  if (loaded) return loaded;
  const mod = await Dexie.waitFor(import('@/lib/import/backup-v3/row-check'));
  loaded = mod.rowProblem;
  return loaded;
}
