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
