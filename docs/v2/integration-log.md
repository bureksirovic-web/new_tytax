# TYTAX v2 integration log

Main checkout `app/`, branch `v2`. One section per merge, written by G5 during INTEGRATION.
An earlier aborted attempt (branch `v2-integration-wave1-attempt`, older SHAs) is reference only.

## 1. merge v2-wave0 (2026-09-27)

- Merge: `297a033` "merge v2-wave0 into v2" (`git merge --no-ff v2-wave0`; v2 was at the merge base 0d09358, wave0 tip 0cfb58e).
- Conflicts: none. v2 had no commits past the merge base (184 files, +14248/-4888).
- Caveats: wave0 has no G<n>-REPORT of its own. `docs/v2/WAVE0.md` and `signals/WAVE0_REVIEW.md` list reproduced review findings routed to the G1-G5 branches; those fixes arrive with the goal merges, not here.
- Gate: `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build`. Exit codes: ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  12 vulnerabilities (2 low, 5 moderate, 5 high)      # npm ci notice, not a gate failure (G1 F5 tracks it)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  52 passed (52)
        Tests  382 passed (382)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
- E2E (`PORT=3100 npx playwright test --project=chromium`, all specs; only `e2e/slice.spec.ts` exists at this step): 2 passed, 0 failed, exit 0.
  ```
  ✓  2 [chromium] › e2e/slice.spec.ts:89:5 › a seeded history shows in the history list (3.0s)
  ✓  1 [chromium] › e2e/slice.spec.ts:19:5 › quick workout survives a reload and lands in history (4.8s)
    2 passed (7.2s)
  ```
  Port 3100 was free this time (the aborted attempt found it held by an unrelated process), so no port deviation.
- @sync specs: none exist yet (they arrive with G5), so no Supabase env was needed.
- Fixes: none needed.
- Deferred: none.
- Unfixed: none.

## 2. merge v2-w2-contracts (2026-09-27)

- Merge: `9b395ea` "merge v2-w2-contracts into v2" (`git merge --no-ff v2-w2-contracts`; branch commits 1505da7, 7c8e087).
- Conflicts: none. One file, `src/contracts/domain.ts` +23/-0, all additive optional fields: `Exercise.measure?: ExerciseMeasure` (new type `'reps' | 'time'`), `SetEntry.durationSeconds?` and `ghostDurationSeconds?`, `ProfileSettings.pinnedExerciseIds?`, `ExerciseNote.setup?: MachineSetup` (new interface). `DEFAULT_PROFILE_SETTINGS` is unchanged (the new field is optional).
- Gate (on 9b395ea): exit codes ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  12 vulnerabilities (2 low, 5 moderate, 5 high)      # npm ci notice, unchanged (G1 F5)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  52 passed (52)
        Tests  382 passed (382)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
- E2E (`PORT=3100 npx playwright test --project=chromium`; only `e2e/slice.spec.ts` exists): 2 passed, 0 failed, exit 0. Port 3100 was free.
  ```
  ✓  2 [chromium] › e2e/slice.spec.ts:89:5 › a seeded history shows in the history list (3.0s)
  ✓  1 [chromium] › e2e/slice.spec.ts:19:5 › quick workout survives a reload and lands in history (5.2s)
    2 passed (7.6s)
  ```
- @sync specs: none yet, so no Supabase env was needed.
- Fixes: `1fed37a` fix(contracts): the new `ExerciseMeasure` type had been inserted between `SetEntry`'s JSDoc and the interface, which orphaned that comment. I moved the comment back. It is a comment-only move. Re-checked with `npx tsc --noEmit` (exit 0) and `npx eslint src/contracts/domain.ts` (exit 0). The full gate was not re-run for this comment move.
- Deferred: none. Unfixed: none.

## 3. merge v2-g1 (2026-09-27)

- Merge: `ccb9ba5` "merge v2-g1 into v2" (`git merge --no-ff v2-g1`; tip fb06355; v2-g1 already contained v2-w2-contracts via 7743ede). 90 files, +57946/-1008 (mostly the regenerated `src/data/tytax/*.json` catalog).
- Conflicts: none. `src/contracts/domain.ts` keeps the `1fed37a` SetEntry JSDoc fix. The contract change from G1 is additive: `PrefillOptions.availableKg?` (request G1-02) plus a doc-comment update on `PrefillResult.basis` in `src/contracts/training.ts`.
- Read: `v2-g1:docs/v2/goals/G1-REPORT.md` and `signals/G1_NOTES.md`. G1 closed F1 (the unresolved stations are now 28 = 1.9 %), F2/F3 on its own side, and F5 (npm audit highs, via `overrides`). Still open per G1: F4 (/settings and /auth/login first-load JS over 250 kB), F6 (station mapping needs an owner review), F7/W2-F1 (follow-ups in G2/G3/G4 files, `docs/v2/requests/G1-03-*`, `G1-W2-01-followups.md`), F8 (analytics callers must pass `lookup`), and W2-F4 (1 low + 4 moderate audit advisories). These belong to G2–G5 and to later merges; this step does not act on them.
- Gate (on ccb9ba5): exit codes ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)               # npm ci notice; high advisories gone (G1 F5 closed)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  64 passed (64)
        Tests  537 passed (537)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
  Extra G1 checks (not part of the gate): `npm audit --audit-level=high` exit 0; `npm run check-bundle` → `check-bundle: OK`; `npm run catalog:build -- --check` → `catalog 1409, unresolved 28 (1.9% of 1436)`.
- E2E (`PORT=3100 npx playwright test --project=chromium`; only `e2e/slice.spec.ts` exists): 2 passed, 0 failed, exit 0. Port 3100 was free.
  ```
  ✓  2 [chromium] › e2e/slice.spec.ts:89:5 › a seeded history shows in the history list (3.0s)
  ✓  1 [chromium] › e2e/slice.spec.ts:19:5 › quick workout survives a reload and lands in history (5.2s)
    2 passed (7.7s)
  ```
- @sync specs: none yet, so no Supabase env was needed.
- Fixes: none needed.
- Deferred: G1's open items F4, F6, F7/W2-F1, F8 and W2-F4 (listed above). They are to be checked when the G2–G5 merges land.
- Unfixed: none.

## 4. merge v2-g2 (2026-09-27)

- Merge: `c5f41ce` "merge v2-g2 into v2" (`git merge --no-ff v2-g2`; tip dfea4ec, matches `signals/G2_DONE`; merge base 7743ede). 197 files, +16271/-1398.
- Conflicts: none. v2-g2 already contained v2-w2-contracts and v2-g1 (its Wave 2 merged them), so the only new content is G2's own `src/lib/{db,import,export}`, hooks, tests and `e2e/profiles.spec.ts`. No `src/contracts/**` change in this merge.
- Read: `docs/v2/goals/G2-REPORT.md` (Wave 1 + Wave 2). The G1-W2-01 follow-ups addressed to G2 are in: `logs.ts` `computeTotals` skips `isTimeSet` in kg volume; `finish.ts`/`prs.ts` rank e1rm only through the repo rules (reps ≤ `E1RM_MAX_REPS`, no time sets).
- Gate (on c5f41ce): exit codes ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)               # npm ci notice, unchanged (G1 W2-F4)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  152 passed (152)
        Tests  1215 passed (1215)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
- E2E (`PORT=3100 npx playwright test --project=chromium`; specs `slice.spec.ts` + `profiles.spec.ts`): 4 passed, 0 failed, exit 0. Port 3100 was free.
  ```
  ✓  2 [chromium] › e2e/slice.spec.ts:89:5 › a seeded history shows in the history list (4.1s)
  ✓  4 [chromium] › e2e/profiles.spec.ts:149:5 › deleting a profile wipes only its data and hands over to the other (4.2s)
  ✓  3 [chromium] › e2e/profiles.spec.ts:135:5 › two profiles see only their own history; switching swaps it (4.6s)
  ✓  1 [chromium] › e2e/slice.spec.ts:19:5 › quick workout survives a reload and lands in history (5.8s)
    4 passed (8.3s)
  ```
- @sync specs: none yet, so no Supabase env was needed.
- Fixes: none needed.
- Deferred (owned elsewhere, check at later merges):
  - `G2-01` (to G5): `E2EHooks` profile methods; `profiles.spec.ts` still drives `window.__tytaxRepo` (non-production only).
  - `G2-02` (to G4): settings UI for import/restore/CSV/pre-migration export with the `inspectBackupJson` confirmation step; `restoreBackupJson` now throws CONFLICT without `{ confirmOverwrite: true }`, so G4's caller must pass it after confirming.
  - `G2-W2-01/02/03` contract requests (`ExerciseNote` setup API, `wipeAll`, `configuredAt?`) for the contract owner.
  - G2 W2 unfixed #2 (back-dated `finishWorkout` re-derives later PR badges): design note for G3's UI.
- Unfixed (carried from G2's report, not integration breakage; not worked here):
  - G2 W2 #1: restore can report a negative `skipped` (`service/backup.ts:59`; `importBackup` counts tombstoned local losers as `updated`). Proposed fix in G2-REPORT.
  - G2 W1 #3: no 20 MiB restore-timing benchmark.
