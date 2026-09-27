# G4-W2-40 — restore writes unvalidated rows (to G1 db, G2 import, dashboard owner)

**From:** G4 (settings/history), Wave 2 hardening, refuter1 findings S2/S3.

## What
`repo.importBackup` (`src/lib/db/repo/transfer.ts`) stores workout-log and profile rows as-is.
A backup row with only `id`+`profileId` (no `exercises`, `date`, totals) or a profile with a
partial `settings` object was accepted and then:
- crashed `/history` on every render (`log.exercises is not iterable`);
- made `logs.count()` (profileId) and `logs.list()` (date index) disagree;
- made every `profiles.updateSettings` throw `VALIDATION` for that profile.

## What G4 already did (branch v2-g4)
- `src/components/settings/backup-validate.ts`: `isValidLogRow` (date `YYYY-MM-DD`, `startedAt`,
  finite `durationSeconds`/`totalVolumeKg`/`totalSets`, exercises with sets of finite kg/reps +
  boolean `done`) and `normalizeSettings` (missing keys ← `DEFAULT_PROFILE_SETTINGS`, invalid
  value → reject). `parseBackupText` now rejects with `bad_logs` / `bad_settings`
  (`BackupFileError` codes `INVALID_LOGS` / `INVALID_SETTINGS`, i18n mapped).
- History renders an already-stored bad row as a deletable "damaged entry" (list, detail, edit);
  the list's count is capped to what `list()` can return.
- `useSaveSettings` sends defaults for missing/invalid stored keys with every save.

## Requested
1. **G1** — validate the same invariants inside `importBackup` (or reuse
   `isValidLogRow`/`mergeSettings`), so no caller (seed hook, sync pull, G2 service) can store
   such rows. Make `logs.count` use the same predicate as `logs.list` (rows without a valid
   `date` are currently counted but never listed).
2. **G2** — when `loadBackupService` switches to `@/lib/import/service` (G4-W2-06), its
   `inspectBackupJson`/`restoreBackupJson` must apply the same checks and error codes
   `INVALID_LOGS` / `INVALID_SETTINGS` (already mapped in `backupErrorKey`).
3. **Dashboard/analytics owner** — `weeklyVolume` & co. throw on such rows (refuter1 fuzz: 42
   throws); guard with `isValidLogRow` until (1) lands.

## Proof
`npx vitest run src/components/settings/__tests__/restore-hardening.test.tsx src/components/history/__tests__/damaged-log.test.tsx`
