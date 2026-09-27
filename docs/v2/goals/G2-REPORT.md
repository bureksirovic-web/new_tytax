# G2 report — persistence, family profiles, migration, import and export

Final SHA: see `signals/G2_DONE` (the commit that adds this report) on branch `v2-g2`. Written: 2026-09-26 23:55.
Base: `v2-wave0` (0cfb58e) merged at 22:55; contracts commit fc1a8bf merged early (22:30) to build pure mappers against the frozen types.

## Gate
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3102 npx playwright test e2e/profiles.spec.ts --project=chromium`
```
✖ 52 problems (0 errors, 52 warnings)        # all i18next/no-literal-string warnings in other goals' .tsx; 0 on G2 files
 Test Files  117 passed (117)
      Tests  949 passed (949)
✓ Compiled successfully in 919ms
✓ Generating static pages using 25 workers (20/20) in 666ms
  ✓  1 [chromium] › e2e/profiles.spec.ts:149:5 › deleting a profile wipes only its data and hands over to the other (3.4s)
  ✓  2 [chromium] › e2e/profiles.spec.ts:135:5 › two profiles see only their own history; switching swaps it (3.6s)
  2 passed (6.1s)
GATE EXIT 0
```
`npx eslint src/lib/db src/lib/import src/lib/export src/hooks/use-{profile*,repo,history}.ts e2e/profiles.spec.ts` prints nothing (clean).

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| AC9 persistence (profiles isolated; delete wipes only that profile) | pass | `PORT=3102 npx playwright test e2e/profiles.spec.ts --project=chromium` + `npx vitest run repo-isolation repo-records repo-finish finish-workout-pr-history review-r01` | `2 passed (6.1s)`; unit `Test Files 7 passed (7) Tests 45 passed (45)`. The e2e seeds logs, bodyweight, a note, arsenal, equipment and a program for each profile; after removing A, A has 0 rows in every table and B's full backup is unchanged. |
| AC10 legacy import (fixture → logs, programs, bodyweight, correct counts) | pass | `npm test -- legacy-import` | `Test Files 13 passed (13) Tests 136 passed (136)`. Counts asserted against `src/lib/import/__fixtures__/expected.ts` for all three fixtures (multi-user dump, single-user dump, app backup). |
| AC18 migration and import safety | pass | `npx vitest run review-mig-r00 migration-dexie migration-v2-realities` and `npx vitest run restore-large-atomic legacy-import-service backup-roundtrip` | `Tests 16 passed (16)` and `Tests 42 passed (42)`. Covered: a real Dexie v2 DB → v3 with `SessionExercise[]`, distinct uids for the same exercise twice, warm-ups excluded from totals; `'local'` rows and family members get real profiles; re-open, re-migration and re-import leave counts and contents unchanged; a failed import (including a 2-user file failing on user 2, and 100/250/1000-row files) leaves the DB unchanged; a failed upgrade rolls back to intact v2 data; the pre-migration export is stored in `meta`. The "offline chunk precached" part of AC18 belongs to G4. |
| AC4 persistence part (rotation advance) | pass | `npx vitest run repo-finish` (inside the AC9 unit run above) | `finishWorkout` advances the rotation in the same transaction; injected failures roll back the advance; the same draft id twice advances once. |
| AC6 persistence part (PRs persisted; warm-ups/undone excluded; non-PR does not fire) | pass | `npx vitest run finish-workout-pr-history review-r01` | Bests come from live logs (review item R01). Tests: 70→80→75 gives no PR; a deleted log's PR is ignored; seeded/imported/migrated history is respected; a corrected fat-finger set no longer blocks PRs. Mutation-checked: the tests fail with a max→min flip and without the `deletedAt` filter. |
| AC2 (≥70 % lines on owned dirs) | pass | see Coverage | 97.5 % lines overall |

## Coverage on owned dirs
Command: `npx vitest run src/lib/db src/lib/import src/lib/export src/hooks --coverage --coverage.include='src/lib/db/**' --coverage.include='src/lib/import/**' --coverage.include='src/lib/export/**' --coverage.include='src/hooks/use-profile*.ts' --coverage.include='src/hooks/use-repo.ts' --coverage.include='src/hooks/use-history.ts' --coverage.reporter=text`
```
                   | % Stmts | % Branch | % Funcs | % Lines
All files          |   97.47 |    94.88 |   98.09 |   97.51
 hooks             |     100 |       95 |     100 |     100
 lib/db            |   93.26 |    95.83 |   84.09 |   93.25
 lib/db/migrations |    99.4 |       94 |   98.94 |   99.22
 lib/db/repo       |   99.15 |    93.85 |    99.6 |   99.86
 lib/export        |     100 |      100 |     100 |     100
 lib/import        |   98.51 |    95.39 |     100 |   99.22
 lib/import/map    |     100 |    99.25 |     100 |     100
```

## What G2 built
- **`src/lib/import`:**
  - A parser for tytax-autonomous app backups and localStorage dumps (`_<user>` suffixes, single-user legacy data).
  - zod (`zod/v4` subpath) validation, a byte and depth cap, and a prototype-pollution guard.
  - A deterministic uuid-v5 mapper to domain records, with a catalog `legacyName` resolver plus a fallback adapter.
  - A BackupV3 validator.
  - Services: `previewLegacyImport`, `importLegacy`, `exportBackupJson`, `inspectBackupJson`, `restoreBackupJson`. The API is documented in `service/index.ts`.
- **`src/lib/export`:**
  - CSV with formula-injection escaping, including `;`/TAB list separators and a NUL prefix.
  - A units option, a BOM only on download, and soft-deleted logs skipped.
- **`src/lib/db`:** Wave 0's repository audited and completed:
  - validation and profile isolation;
  - typed `STORAGE`/`VALIDATION`/`CONFLICT`/`NO_ACTIVE_PROFILE` errors;
  - an atomic, idempotent `finishWorkout` (five injected-failure tests);
  - last-write-wins `applyRemote` with ownership and shape guards;
  - one live note/arsenal row per (profile, exercise);
  - an insertion-ordered outbox and per-transaction sync notification.
- **Migration:** the v2→v3 Dexie upgrade runs pure, deterministic transforms (`src/lib/db/migrations/**`) and keeps the pre-migration export in `meta` (`getPreMigrationExport`).
- **Hooks:** `useProfiles`, `useProfileActions`, a fixed `useHistory` (page reset per profile, steps back from an empty page), and `useRepoQuery`.
  - **Behaviour change for every caller of `useRepoQuery`:** a failed live re-run now clears `data` instead of showing stale data.
- **Adversarial process:** 6 workflows ran build → refute → fix.
  - Refuters reproduced several dozen findings, all fixed with permanent tests, apart from the two open items below.
  - All six G2 items in `signals/WAVE0_REVIEW.md` (R00, R01, R02, S3-11, S3-12, S3-13) are fixed or proven already fixed. Each proof was checked to fail on `v2-wave0`.

## Requests made
- `docs/v2/requests/G2-01.md` (to G5, not blocking): add `setActiveProfile`/`removeProfile`/`listProfiles` to `E2EHooks`. Until then, `window.__tytaxRepo` (non-production only, `src/lib/db/index.ts`) drives the profile e2e.
- `docs/v2/requests/G2-02.md` (to G4, not blocking): wire the settings screen to the import, restore, CSV and pre-migration-export APIs, and add a confirmation step using `inspectBackupJson`.
- i18n: none. G2 adds no UI strings.
- Contracts: no change requested.

## Unfixed findings
1. **Hostile backup can overwrite an existing local profile once.**
   - **Evidence:** `backup-restore-future-stamps.test.ts`. A backup that reuses Ana's profile id with a newer `updatedAt` renames her and adds rows on restore. Pinning with a far-future stamp is fixed: timestamps more than 24 h ahead are clamped.
   - **Why not fixed:** stopping it needs a user confirmation, and that UI is G4's.
   - **Proposed fix:** the settings UI calls `inspectBackupJson` and requires confirmation when `existingProfileIds` is non-empty (G2-02).
2. **Editing one log does not re-annotate `isPR`/`prCount` on later logs.**
   - **Evidence:** the R01 fix notes. `logs.update` reconciles only the edited log.
   - **Why not fixed:** the review item accepted the minimum. PR detection at finish time is correct because it reads live logs; only the historical badges on later logs can be stale.
   - **Proposed fix:** after an edit, re-run `reconcileLogPRs` over the profile's later logs in date order, in the same transaction.
3. **No 20 MiB restore-timing test.**
   - **Evidence:** a refuter measured a 20 MiB BackupV3 parse at about 600 ms, reaching the write phase in about 4 s. The 100+ row transaction bug that made it fail is fixed and tested at 1000 rows.
   - **Why not fixed:** time. A timing test on a shared machine would be flaky.
   - **Proposed fix:** a benchmark script outside `npm test`.

## Given up on
- Nothing in G2 scope.

## Estimate vs actual
- Wall clock: estimate 6–8 h for all goals in parallel. G2 actual: 22:09 → 23:55, about 1 h 50 min, of which about 45 min was waiting for Wave 0 (spent on the pre-Wave-0 parser, CSV and contract-based pure modules).
- Paid tokens: Claude (Opus workflows), 6 workflows, about 3.5 M subagent tokens in total (0.44 M + 0.82 M + 1.33 M + 0.48 M + 0.32 M + the main loop). Local lane: 0 agent-hours; ultracode covered the refuter role.

---

# Wave 2 (2026-09-27 00:21 → 02:25)

Merged: `v2-w2-contracts` (twice: fields, then `ghostDurationSeconds`), `v2-g1` (coordinator instruction; its `rankableE1rm`/`isTimeSet`/`E1RM_MAX_REPS` replace G2's stubs). Scratch merge with `v2-g3` + `v2-g4` in a throwaway worktree (02:05): clean, `npx tsc --noEmit` rc 0, `npx vitest run` `Test Files 281 passed (281) / Tests 2148 passed (2148)`; aborted and removed.

## Gate (at 7992307; e253d8b after it only removes an unused import in one test, re-checked with tsc, eslint and that file's 6 tests)
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3102 npx playwright test e2e/profiles.spec.ts --project=chromium`
```
✖ 53 problems (0 errors, 53 warnings)     # i18next warnings in other goals' files after the v2-g1 merge; G2 files: 0 after e253d8b
 Test Files  152 passed (152)
      Tests  1214 passed (1214)
✓ Compiled successfully in 1733ms
  2 passed (6.6s)
GATE EXIT 0
```

## Items
| Item | Status | Proof (command → output) |
|---|---|---|
| 1 (S2) G4-26/G4-47: `logs.update` recomputes e1rm/isPR/prCount/PR records for the edited log and every later log, one transaction; softDelete/restore too | done | `npx vitest run w2-` → `Test Files 23 passed (23) Tests 113 passed (113)` (w2-prs-rebuild, w2-prs-rebuild-all incl. the G4-47 repro as a repo test, w2-prs-chains, w2-prs-restore-stamp-perf) |
| 2 (S2) G3-02: import/restore write PR records derived from history | done | w2-import-prs (db + import): import 100x5 with `prRecords: []` → baselines; next 120x5 is a real PR (prCount 2: e1rm + weight); re-import writes nothing |
| 3 F3: e1rm stored only for reps ≤ 12 | done, on G1's `rankableE1rm` | w2-prs-f3-time; stored e1rm now rounded to 0.01 kg (G1 rule), two older expectations updated with the derivation |
| 4 time sets: `durationSeconds` persisted; excluded from kg volume and PRs | done | w2-prs-f3-time, w2-backup-time-sets (backup schema kept dropping `durationSeconds` until the DSH round) |
| 5 machine setup: `ExerciseNote.setup`, `getSetup`/`setSetup` | done (implementation ext `getNotesExt(repo)`); contract request `G2-W2-01` | w2-misc-notes-setup, w2-backup-setup-pins (JSON round trip), w2-notes-empty-setup-restore |
| 6 G4-30 `pinnedExerciseIds` in settings | done; bad stored lists are sanitised (repo and backup schema share `sanitizePins`) | w2-settings-stored-bad-pins, w2-backup-setup-pins |
| 7 G4-36 device wipe + equipment "not configured" | done: `getWipeAll(repo)`, `isEquipmentConfigured(inv)`; requests `G2-W2-02` (bless wipeAll), `G2-W2-03` (`configuredAt?`) | w2-misc-wipe-equipment |
| 8 G1-03 items for G2 (R00 'local' orphans, R01, R02, S3-11/12/13) | closed in Wave 1 (commit 6e9b8c5, each proof checked to fail on `v2-wave0`) | review-* tests |
| 9 hostile restore overwrite (Wave 1 unfixed #1) | done: `inspectBackupJson` returns per-profile conflicts, `requiresConfirmation`, `resurrectsProfileIds`; `restoreBackupJson` throws CONFLICT without `{ confirmOverwrite: true }`; rows with clamped future stamps never replace existing rows | w2-inspect-conflicts, w2-restore-clamped-pin, w2-restore-resurrect-profile, backup-restore-future-stamps |
| G4-35 item 3 | done: `downloadCSV` defers `revokeObjectURL` | w2 export test |
| AC10 regression | pass | `npm test -- legacy-import` → `Test Files 13 passed (13) Tests 134 passed (134)` (136 before: two unit tests of the deleted duplicate `planPRs`/`stampAfter` were removed with that code; the behaviour is covered by w2-import-prs) |

API for G4 (settings / exercise detail): `getRepository()` returns `RepositoryExt`; `getNotesExt(repo).{getSetup,setSetup}`, `getWipeAll(repo)`, `isEquipmentConfigured` from `@/lib/db`; `inspectBackupJson`, `restoreBackupJson(repo, text, { confirmOverwrite })`, types `BackupProfileConflict`, `BackupOwnedTable`, `RestoreBackupOptions` from `@/lib/import`.

## Coverage on owned dirs (same command as Wave 1)
```
All files          |   97.66 |    95.86 |   98.22 |   97.64
 hooks             |     100 |       95 |     100 |     100
 lib/db            |   93.69 |    95.94 |   85.41 |   93.54
 lib/db/migrations |    99.4 |       94 |   98.94 |   99.22
 lib/db/repo       |   99.38 |    96.22 |   99.65 |   99.77
 lib/export        |     100 |      100 |     100 |     100
 lib/import        |   98.51 |    95.39 |     100 |   99.22
 lib/import/map    |     100 |    99.25 |     100 |     100
```

## Hardening
- Claude refuters inside the build workflow: 11 findings reproduced, 10 fixed, 1 not reproducing (measured, dropped).
- **Local refuters (DSH/Qwen, 2 live, engine queue 0 / token_usage 0.65 at start 01:00):** stopped at 02:17 to keep the 03:00 deadline; their final summaries were never produced ("not completed"). They left 9 reproduction files, 26 failing cases:
  - 20 fixed, each a permanent `w2-*` test: log `programId` ownership and `programSessionId` on edit; `date` follows an edited `startedAt`; backup keeps `durationSeconds`/`ghostDurationSeconds`; totals repair uses the repo's `computeTotals`; restore of clamped rows is idempotent and never beats later local edits; resurrecting a deleted profile needs confirmation; an empty setup is not a live note; an equipment row whose id ≠ profileId is refused.
  - 4 dropped as design choices, with measurement: an older own backup never beats newer rows (LWW); `existingProfileIds` lists live profiles only; a tombstone for a row the device never had is not an "addition" (2 cases). Each contradicts a committed test that states the intended behaviour.
  - 2 unfixed (below).
- One slip, fixed: 03b4dda was committed with 3 failing tests (my commit chain did not gate on vitest); fixed in 236d939 twenty minutes later.
- Design note: `upsertRows` (`src/lib/db/repo/rows.ts`) clears and refills a table when a rebuild rewrites ≥ half of it. Measured under fake-indexeddb: an edit over 1000 logs took 10.5 s before, 1.26 s for the whole test after. It is atomic (same transaction; rollback tested) and keeps other profiles' rows (tested). In a real browser it does at most twice the writes.

## Wave 2 unfixed findings
1. **Restore can report a negative `skipped`.**
   - **Evidence:** a 4-row backup (1 profile, 3 newer notes under new ids for exercises that already have notes) gives `inserted 3, updated 3, skipped -2`. `importBackup` counts the local losers it tombstones (natural-key rule) as `updated`, and `service/backup.ts:59` computes `skipped = rowCount - inserted - updated`.
   - **Why not fixed:** found at 02:17; the fix changes `importBackup`'s count semantics, which `repo-import-natural-key.test.ts` (lines 33, 109) pins. There was no time to change both safely before 03:00.
   - **Proposed fix:** `planTable` counts local-loser tombstones separately (`tombstonedLocal`); `inserted`/`updated` count in-file rows only; update those two expectations to `updated: 0` and the doc comment at `import-plan.ts:19-21`.
2. **`finishWorkout` of a back-dated draft re-derives later logs**, but only for the finishing profile's live logs. This is working as designed; noted for G3's UI, where a back-dated finish can change the PR badges of later sessions.

## Estimate vs actual (Wave 2)
- Wall clock: 00:21 → 02:25, about 2 h 05 min (deadline 03:00).
- Tokens: 3 Claude workflows (about 0.79 M + 0.28 M subagent tokens, plus the main loop). Local lane: 2 DSH agents for about 1 h 15 min.
