# G4-W2-06: settings backup/restore uses G2's service at integration (owner: G5, integration)

**From:** G4 (Wave 2, S2 G2-02 / G2 unfixed #1). **Blocking:** no. Until the switch, the app uses a
local service with the same semantics, including the confirmation step.

`@/lib/import/service` (G2) does not exist in branch v2-g4. A static import of a missing module
breaks the build, so `src/components/settings/backup-service.ts` ships with
`loadBackupService()` returning `localBackupService`. That local service:
- validates with `parseBackupText`;
- inspects against `repo.profiles.list({ includeDeleted: true })`;
- restores with `repo.importBackup`.

## One-line switch (after v2-g2 is merged)
In `src/components/settings/backup-service.ts`, function `loadBackupService`, replace
```ts
  return localBackupService;
```
with
```ts
  return fromG2Service((await import('@/lib/import/service')) as unknown as Record<string, unknown>) ?? localBackupService;
```
Then the settings UI calls `exportBackupJson(repo, profileId, { pretty: true })`,
`inspectBackupJson(repo, text)` and `restoreBackupJson(repo, text)`.

## Verified in the merged scratch tree
Tree: `integ2` (v2-g4 plus the current v2-g1/g2/g3/g5), with the switch applied.
- `npx vitest run src/components/settings "src/app/(app)/settings"`: 15 files, 90 tests pass.
- `npx tsc --noEmit`: no errors in settings files. This shows G2's real signatures are compatible with the adapter.
- `npx eslint --max-warnings 0` on the settings files: clean.
- A scratch-only real-path test (not committed; it needs G2's modules) passed 3/3:
  - G2 `inspectBackupJson` flags the existing profile;
  - G2 `restoreBackupJson` rejects a bad file with a coded error;
  - the real `bodyweightToCSV(..., { units: 'lb' })` writes 220.5 for 100 kg;
  - `getPreMigrationExport`/`clearPreMigrationExport` work through `preMigrationApiFrom`.

No switch is needed for CSV units or the pre-migration export. Both are detected at runtime with
`typeof` checks on modules that exist in both trees (`@/lib/export/csv`, `@/lib/db/migrations`).
