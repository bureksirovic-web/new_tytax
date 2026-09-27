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

## 5. merge v2-g3 (2026-09-27)
- Merge: `4e5a7e0` "merge v2-g3 into v2" (`git merge --no-ff v2-g3`; tip ef28ec0, matches `signals/G3_DONE`; merge base 7743ede). 177 files, +16095/-829.
- Conflicts: none. v2-g3 already contained v2-w2-contracts and v2-g1; G3's scratch merge with v2-g2 (G3-REPORT Wave 2) predicted a clean merge. No `src/contracts/**` change.
- Read: `docs/v2/goals/G3-REPORT.md` (Wave 1 + Wave 2) and requests G3-W2-01/02/03. Merge-relevant items:
  - G3-W2-01: flip the read-only machine-setup e2e to a save test once v2-g2 is in -> done (fix cbafa38).
  - G3-W2-02 §1/§3 (orderByStation swap, snapToBells removal): already done on v2-g3. §2 (inventory vs catalog station vocabulary, bridged by `stationKey`), §5 (weak-point `fresh` rule): product/vocabulary notes, no merge action.
- Gate on 4e5a7e0: ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)               # npm ci notice, unchanged
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  213 passed (213)
        Tests  1737 passed (1737)
  ```
- E2E on 4e5a7e0 (`PORT=3100 npx playwright test --project=chromium`): 32 passed, 1 failed, exit 1. Port 3100 free.
  - `e2e/workout-wave2.spec.ts:157 machine setup: this branch has no setup writer, so the sheet is read-only with a notice` — `expect(locator).toBeVisible() failed` on `setup-readonly`: expected, the G2 writer (`repo.notes.getSetup/setSetup`) is now merged and the sheet is writable.
- Extra check `npm run check-bundle` on 4e5a7e0: FAIL — `/dashboard 264.7 kB gzip (budget 250 kB): OVER` (PLAN §10.2 AC8).
  - Bisected in a throwaway worktree: ccb9ba5 (after v2-g1) 204.9 kB OK; c5f41ce (after v2-g2) 262.1 kB OVER. So the regression came in with the v2-g2 merge (step 4 did not run check-bundle); v2-g3 adds only 2.6 kB.
  - Cause: `src/lib/db/repo/{import-plan,apply-remote}.ts` statically imported `@/lib/import/backup-v3/row-check` (zod + the BackupV3 schema), pulling it into the repository and so into every route's first-load chunk.
- Fixes:
  - `cbafa38` fix(integration): machine setup is writable after v2-g2 + v2-g3. The e2e is corrected (with a comment why) per G3-W2-01 to prove edit -> save -> card summary -> reload -> clear -> Escape returns focus. New unit test pins `SETUP_FIELD_MAX`/`SETUP_FIELDS` to G2's `MAX_SETUP_FIELD_LENGTH`/`MACHINE_SETUP_KEYS` and saves/loads/clears through the real repo.
  - `04e4ce5` fix(integration): keep zod out of first-load JS. New `src/lib/db/repo/row-check-lazy.ts` loads `rowProblem` on first use via `Dexie.waitFor(import(...))`; `validateBackup(backup, rowProblem)` takes it as a parameter. First attempt used a plain `await import()`: 6 legacy-import tests failed with `RepoError: Transaction has already completed or failed` (the legacy import calls `importBackup` inside `repo.transaction`); `Dexie.waitFor` keeps that transaction alive, all pass.
- Gate on 04e4ce5 (final): ci=0 lint=0 tsc=0 test=0 build=0, check-bundle=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)
  ✖ 52 problems (0 errors, 52 warnings)
   Test Files  213 passed (213)
        Tests  1738 passed (1738)
  first-load JS for /dashboard: 217.0 kB gzip (budget 250 kB), 14 files
  check-bundle: OK                                     # /workout/active 242.9 kB, /settings 284.9 kB, no catalog leak
  ```
- E2E on 04e4ce5: 33 passed, 0 failed, exit 0 (profiles 2, program-rotation 2, progression 5, pr 3, slice 2, tools 5, workout-foreign-draft 2, workout-loop 5, workout-quick 1, workout-wave2 6). No @sync specs yet, no Supabase env needed.
- Deferred (owned elsewhere, check at later merges):
  - G4 merge: G3-03 testids (`dashboard-next-session`, `install-preset`) so AC4 runs through the programs UI + dashboard; G3-04 foreign draft on dashboard/settings; G3-W2-03 History renders time sets as `m:ss` (today `0 kg × 0 reps`, S2); G4-25 Repeat button over `startFromLog`; `countsAsWork` now requires reps > 0 (history/[id]); 360 px kg input 0 px spare (a11y pass); fold `docs/v2/requests/G3-i18n.md` strings into the dictionary.
  - G4 merge: the service worker must be able to serve the lazy row-check chunk (backup restore while offline) — check with offline.spec.ts.
  - G5 merge: G3-01 `Page`/`Locator` types from `e2e/fixtures`; G3-03 `listPRRecords` hook; G3-W2-02 §4 `e2e-hooks.ts` looser `isWorkoutDraft` (import the strict one from `@/stores/workout-store`, seeds use ISO `startedAt`); G3-W2-03 `SeedSetInput.durationSeconds`.
- Unfixed (carried from G3's report, not integration breakage; not worked here):
  - Repeat with no draft has no catalog loaded, so an old hold logged as reps repeats as reps (`draft-ops.ts`; proposed: async `repeatLog` awaiting `catalog.loadCatalog()`).
  - `e1rm` contract formula grows steeply at 30-36 reps (tool warns above 12; PRs capped at 12 reps) — contract owner decision.
  - Mobile Playwright project not run (chromium only, per the task).

## 6. merge v2-g4 (2026-09-27)
- Merge: `1f33b2d` "merge v2-g4 into v2" (`git merge --no-ff v2-g4`; tip 63961e8, matches `signals/G4_DONE`; merge base 7743ede). 400 files, +28496/-4315.
- Conflicts: none. No file was changed on both sides since the merge base (`comm -12` of the two `--name-only` diffs is empty); no `src/contracts/**` change. v2-g4 contains v2-wave0 and v2-w2-contracts, not v2-g1/g2/g3.
- Read: `docs/v2/goals/G4-REPORT.md` (Wave 1 + Wave 2), requests G4-01/02/03/35/40, G4-W2-06/07. Merge-relevant:
  - G4-35 (legacy import through `@/lib/import`) and G4-W2-06 (backup via G2's service): possible now that v2-g2 and v2-g4 are both in -> applied (c6c45c3).
  - G4-02 `page-heading-workout`: already on G3's `/workout` h1; nav + a11y specs pass.
  - G4 W2 unfixed "G3 tests fail once G2 is merged" (`setup-adapter.test.ts`, `use-workout-w2.test.ts`): not reproduced, the unit suite is all green (fixed at step 5, cbafa38).
  - Step 5 deferrals for this merge: G3-03 test ids (`dashboard-next-session`, `install-preset`), G3-04 foreign draft, History time sets, G4-25 Repeat over `startFromLog`, G3 i18n fold: all present in G4's code. "SW must serve the lazy row-check chunk": it did not -> fixed (5eabb04).
- Gate on 1f33b2d: ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)               # npm ci notice, unchanged
  ✖ 7 problems (0 errors, 7 warnings)                 # all i18next/no-literal-string in src/app/auth/login/page.tsx (G5); G4 retired the stale copies behind the old 52
   Test Files  288 passed (288)
        Tests  2177 passed (2177)
  ```
  Extra `check-bundle`: FAIL, `/dashboard 259.2 kB gzip (budget 250 kB): OVER` (see Unfixed).
- E2E on 1f33b2d (`PORT=3100 npx playwright test --project=chromium`, port 3100 free): 51 passed, 5 failed, 2 did not run, exit 1.
  - `offline.spec.ts:37` "offline.spec needs E2E_SERVER=prod" (+2 did not run, serial): by design under `next dev` (G4-03; the npm script/CI split is G5-09, lands with v2-g5).
  - `pr.spec.ts:62/101/132`: `toHaveURL(/\/workout\/active$/)` received `http://127.0.0.1:3100/workout` after 5 s (the draft was created, the navigation had not finished).
  - `profiles-ui.spec.ts:11`: `page.goto /history` test timeout 30 s.
  - Solo re-run of pr + profiles-ui: 6/6 pass. Second full run: the same 4 failed. Full run with service workers blocked (scratch config): 55/55 in 19.7 s vs 40 s. Cause: G4's worker precaches all 12 shell routes on install and again on CACHE_URLS, so under `next dev` every fresh test context made the dev server SSR-render about 24 pages.
- Fixes:
  - `f23e4bb` fix(integration): block service workers in e2e except offline.spec. `serviceWorkers: 'block'` in `playwright.config.ts` `use`, with a comment giving the evidence; `offline.spec.ts` opts back in with `test.use({ serviceWorkers: 'allow' })`. No assertion changed. (G5's playwright.config diff touches other lines.)
  - `c6c45c3` fix(integration): wire settings legacy import and backup to G2's service. G4-35 step 1 verbatim (`loadLegacyImportApi` imports `@/lib/import`; before, the legacy import button stayed disabled in the merged tree) plus step 2's `legacy-import.integration.test.tsx`; G4-W2-06 one-line switch in `loadBackupService`. Settings tests 19 files/103 pass. G4-35 step 4 (drop the two `legacy` lines of `data-card.test.tsx`) not applied: the test still passes (the API loads asynchronously) and nothing is deleted without a failure; it is racy by design, see Deferred.
  - `5eabb04` fix(integration): service worker caches lazy chunks; offline restore e2e. New `offline.spec` test "a backup can be restored while offline" (prime on /dashboard, then /settings offline: download backup, restore it). Red first: `/settings` hit the error boundary ("Nešto je pošlo po zlu"; trace: `ChunkLoadError: Failed to load chunk /_next/static/chunks/1tcztxp2lsjxa.js`), because lazy chunks (G4's next/dynamic settings panels, G2's backup service, the lazily loaded row validator from 04e4ce5) are named only inside other chunks' loader code (`"static/chunks/x.js"`), never in page HTML. `public/sw.js` now follows those references transitively when caching (`cacheChunksDeep`; the unused `cacheEach` removed). A first attempt warmed the modules from the layout with `import()`; it failed because Turbopack emitted different chunk files for that import site (module 12732 in both `1tcztxp2lsjxa.js` and `35nd5o8dtw65p.js`), so it was reverted.
  - `1013e5f` test(integration): every offline test goes offline via `goOffline()` = `context.route('**/*', abort)` + `setOffline`. Probe evidence: with `setOffline` alone the worker's own fetch of a never-cached chunk returned 200 (`request.serviceWorker()` set). Stricter only.
- Gate on 1013e5f (final): ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)
  ✖ 7 problems (0 errors, 7 warnings)
   Test Files  289 passed (289)
        Tests  2179 passed (2179)
  first-load JS for /dashboard: 259.4 kB gzip (budget 250 kB)   # check-bundle exit 1, see Unfixed
  ```
- E2E on 1013e5f: 55 passed, 1 failed, 3 did not run, exit 1; the only failure is `offline.spec.ts:53` "needs E2E_SERVER=prod" (by design under dev, G4-03/G5-09). Prod step `NEXT_PUBLIC_E2E_HOOKS=1 npm run build && E2E_SERVER=prod PORT=3100 npx playwright test e2e/offline.spec.ts --project=chromium`: 4 passed, exit 0 (also 12/12 with `--repeat-each=3` before 1013e5f, 8/8 with `--repeat-each=2` after). No @sync specs yet (v2-g5 not merged), no Supabase env needed.
- Deferred (owned elsewhere, check at later merges):
  - G5 merge: G4-01/G4-40 LocaleProvider (hydration mismatch on every hard load; the pr.spec failure snapshots show "1 Issue" in the Next overlay; G5 report says applied), G4-03/G5-09 offline npm script and CI job, G4-W2-07 `settings-account` test id in G5's `settings-flag-off.test.tsx`, G4-W2-01 switch G3/G5 local string tables to the dictionary, G4-W2-05 `/auth/login` 304.2 kB, G5-06 AccountSection hidden when sync is off. G5-03 (worker must not intercept cross-origin GETs): `sw.js` `isExcluded` already returns early for cross-origin; re-check after the merge.
  - G4-35 step 4: `data-card.test.tsx` "shows the not-yet-available controls disabled" asserts the legacy button disabled right after render; true only until the async API load finishes. Correct it (with a comment) if it ever fails.
  - Contract/library follow-ups from G4-REPORT (G4-10/15/16/17/20/21/22/26/31/36/37/41/52, G4-W2-16/40/45): product/contract decisions, no merge action.
- Unfixed:
  - check-bundle `/dashboard` 259.4 kB gzip > 250 kB (PLAN §10.2 AC8; not a gate step). Also over: `/analytics` 260.1, `/exercises/[id]` 267.2, `/settings` 259.5, `/workout` 262.2, `/workout/active` 275.7, `/auth/login` 304.2 kB; no catalog leak on any route.
    - Evidence: 217.0 kB at 04e4ce5, 245.8 kB in G4's own tree, 259.2 kB after the merge. Source-map attribution of the 17 first-load files (scratch build with `productionBrowserSourceMaps`, not committed): the i18n dictionary (`src/lib/i18n/{en,hr}.ts` + all `modules/*`, both locales, one 37.7 kB gzip chunk) is most of G4's addition; next ~447 kB and dexie ~51 kB of unminified-gzip source are the framework/runtime base.
    - Tried: attribution only (about 25 min). There is no cheap cut: `t()` is synchronous and imported directly in 46 files.
    - Proposed fix: once G5's LocaleProvider (G4-01) lands, load the non-active locale's dictionary lazily (`en` for the hr default; the provider awaits it before switching), or split the dictionary per route. Owner: i18n (G4 scope).
  - Carried from G4-REPORT, not integration breakage, not worked here: `prCount`/PR records stale after editing a PR set (G4-47, G2 `logs.update`); e1RM blow-up near 36 reps (G4-41, owner decision); page `<title>` metadata not localised; Recovery thresholds owner question.
  - Mobile Playwright project not run (chromium only, per the task).
