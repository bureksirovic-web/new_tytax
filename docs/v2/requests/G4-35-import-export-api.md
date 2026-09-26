# G4-35 — Settings needs G2's import/export entry points

**From:** G4 (settings) · **To:** G2 (`src/lib/import`, `src/lib/export`) · **Date:** 2026-09-26

## What
Settings calls G2's libraries through one adapter, `src/components/settings/export-adapter.ts`
(dynamic import, so nothing lands in the settings first-load chunk). In branch v2-g4 today:

| Need | Status in v2-g4 | Used by |
|---|---|---|
| `workoutLogsToCSV(logs: WorkoutLog[]): string` in `@/lib/export/csv` | exists (old version) | "Workouts (CSV)" button — works |
| `bodyweightToCSV(entries: BodyweightEntry[]): string` in `@/lib/export/csv` | **missing** | "Bodyweight (CSV)" button — rendered disabled with "Not available yet" |
| `@/lib/import` module with legacy parse + commit | **missing (module absent)** | "Import from the old TYTAX app" — rendered disabled with "Not available yet" |

## Exact proposed change
1. Export `bodyweightToCSV(entries: BodyweightEntry[]): string` from `src/lib/export/csv.ts`
   (header in kg, soft-deleted rows excluded, formula-injection-safe cells). The adapter picks it up by
   name automatically; no settings change needed.
2. Ship `src/lib/import/index.ts` exporting
   - `parseLegacy(text: string): LegacyImportBundle` (throws `ImportError` with `code`), and
   - `commitLegacyImport(repo: Repository, bundle: LegacyImportBundle, mapping: Record<legacyUser, {newProfileName: string} | {profileId: string}>): Promise<{ logs: number; unresolved: number }>`.
   Then in `export-adapter.ts` `loadLegacyImportApi()` becomes
   `const mod = await import('@/lib/import'); return { parse: mod.parseLegacy, commit: mod.commitLegacyImport };`
   and G4 (or the integrator) wires the preview/mapping dialog (spec §6.3; the `set_legacy_*` strings exist).
3. `downloadCSV` in `csv.ts` revokes the object URL synchronously (spec §6.4); settings does not use it
   (it has its own deferred-revoke `downloadText`), but other callers should get the fix.

## Why
Spec G4-spec-settings §6.3/§6.4; GOALS G4 settings: legacy import + CSV export. A static import of a
module that does not exist breaks `tsc` and the build, hence the adapter.

## Local workaround (in place)
JSON backup/restore uses the frozen `repo.exportBackup` / `repo.importBackup` directly, with a local
validator (`backup-io.ts`: size cap, JSON, `__proto__`/`constructor`/`prototype` rejection,
format/version, per-table row checks) and a preview with counts before any write. CSV bodyweight and legacy
import are disabled controls with `set_feature_pending` as their accessible description.
