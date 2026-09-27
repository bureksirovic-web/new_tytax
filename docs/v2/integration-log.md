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

## 7. merge v2-g5 (2026-09-27)
- Merge: `2fef833` "merge v2-g5 into v2" (`git merge --no-ff v2-g5`; tip 7490d3a "docs(v2): G5 report"; merge base 0cfb58e = v2-wave0). 144 files, +13400/-2785.
- Conflicts: none. The only file changed on both sides since the merge base is `playwright.config.ts`; git auto-merged it and both sides are kept (G5: required PORT, `testMatch`, `failOnFlakyTests` in CI, no-skips reporter, pinned Supabase/APP_URL webServer env; step 6: `serviceWorkers: 'block'`). eslint.config.mjs, vitest configs, ci.yml, e2e/fixtures, providers, CHANGELOG and README were changed on the G5 side only, so no hand merge was needed.
- Read: `docs/v2/goals/G5-REPORT.md`, requests G4-01, G4-40, G4-37, G4-W2-01, G4-W2-05, G4-W2-07.
- Gate on 2fef833: ci=0 lint=1 tsc=2 test=1 build=1.
  - lint: `✖ 10 problems (7 errors, 3 warnings)`. The 7 errors are G5's R08 state-query bans hitting G2/G3/G4 specs (`nav.spec.ts:37,53`, `profiles-ui.spec.ts:25`, `profiles.spec.ts:88`, `tools.spec.ts:119`, `workout-loop.spec.ts:32`, `workout-wave2.spec.ts:223`).
  - tsc and build: `.next/types/validator.ts(251,39): error TS2307: Cannot find module '../../src/app/api/profile/route.js'` (also sync, workout). These were stale generated types for the routes G5 deleted. `.next` is git-ignored build output; `rm -rf .next` cleared it, and a fresh clone never has it.
  - test: `Tests 1 failed | 2398 passed (2399)`, namely `settings-flag-off.test.tsx`: `Unable to find an element by: [data-testid="settings-account"]` (G4-W2-07).
- Fixes:
  - `4c29591` fix(integration): G4-W2-07. `settings-flag-off.test.tsx` now waits for `settings-sync-slot`, with a comment. The zero-network assertions are unchanged. (G5's copy of `settings/page-client.test.tsx` did not exist; G4's version is the only one.)
  - `9484c41` + `c68d603` fix(integration): LocaleProvider reconcile (G4-01/G4-40).
    - The provider was not in conflict. v2 still had wave0's version (initial `'en'`, localStorage read in a `useState` initialiser). G5 brought the `useSyncExternalStore` version: server snapshot `DEFAULT_LOCALE`, stored locale after hydration, blocked-storage guard, `t(key, vars)`. G5's `locale-core.ts` was a shim with `DEFAULT_LOCALE = 'en'`, so it is now a re-export of G4's `@/lib/i18n` (`DEFAULT_LOCALE = 'hr'`).
    - The profile language after hydration comes from G4's `ProfilePrefsSync` (in the `(app)` layout), through `setLocale`.
    - With the real `'hr'` default, 186 G1-G4 unit tests failed. They assert English copy that was written against the `'en'` default.
    - `src/test-setup.ts` now mocks `locale-core`'s `DEFAULT_LOCALE`/`readStoredLocale` to `'en'` for unit tests, with a comment. No assertion changed. `locale-provider.test.tsx` calls `vi.unmock` and pins the real module: a new test checks `DEFAULT_LOCALE === 'hr'` and that it is the same function as `@/lib/i18n`. The hr SSR and hydration cases were already there.
    - The context default `t` outside a provider still echoes the key; G4-01 proposed translating. Nothing in the app renders outside `<Providers>`, and 30 programs tests query by key without a provider. This deviation is recorded in a code comment.
  - `bb4448c` fix(integration): 7 e2e specs comply with R08 without weakening:
    - nav: `String(getAttribute('href'))` on `a[href]`;
    - profiles-ui: the count comes from `tytax.listProfiles()`, plus a new `toHaveCount(before)`;
    - profiles: `repo.logs.list().length` replaces the repository's `count()`, which clashes by name with the ban;
    - tools: `textContent` is checked with `expect`;
    - workout-loop: `addExercise` takes the expected card count and asserts the count before and after;
    - workout-wave2: the row count is a constant.
  - `7108a07` fix(integration): with sync on, `/settings` mounts G5's `SyncDetails` in G4's sync slot. `role="status"` on its `<dd>` failed `a11y.spec.ts:33` with `"definition-list: dl"` (serious). The role now sits on an inner span; the test ids stay on the `<dd>`.
  - `5fab111` + `1033f9b` test(integration): `fillLoginEmail` in `e2e/fixtures/supabase.ts`, used by `sync-roundtrip.spec.ts` and `auth-callback.spec.ts`.
    - Symptom: in the full parallel run, `sync-roundtrip.spec.ts:63` failed with a 120 s test timeout (the failure context shows "Nastavi s e-mailom" `[disabled]` with the email typed in), and `auth-callback.spec.ts:86` failed the same way on the second run. Both passed alone (6/6).
    - Cause: the email was filled before hydration, and React's value tracker then drops the unchanged refill.
    - Fix: clear, fill, and retry until the button is enabled (`toPass`, 30 s).
- Gate on 1033f9b (final): ci=0 lint=0 tsc=0 test=0 build=0.
  ```
  5 vulnerabilities (1 low, 4 moderate)                # npm ci notice, unchanged
  ✖ 3 problems (0 errors, 3 warnings)                  # i18next/no-literal-string on template literals (G5 R11): sidebar.tsx:23 headingId, program-session-list.tsx:91 editHref, profile-list.tsx:34 reasonId
   Test Files  309 passed (309)
        Tests  2400 passed (2400)
  ✓ Compiled successfully
  ```
  Extra `check-bundle`: FAIL, `/dashboard 262.7 kB gzip (budget 250 kB): OVER`. It was 259.4 kB before this merge. `/auth/login` went down from 304.2 to 241.7 kB because G5's helpers load supabase-js lazily. See Unfixed.
- Sync checks with the local Supabase env (stack from ../g5, project_id tytax-v2; `supabase status -o env` works from app/). Exports: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SYNC_ENABLED=true`, `NEXT_PUBLIC_APP_URL=http://localhost:3100`. The playwright config pins APP_URL to `http://127.0.0.1:3100` for its server anyway.
  - `npm run test:sync`: exit 0, `Test Files 2 passed (2) / Tests 16 passed (16)`.
  - `npx -y supabase@2.118.0 test db`: exit 0, `Files=9, Tests=789 … Result: PASS`.
- E2E (`PORT=3100 npx playwright test --project=chromium`, sync env; port 3100 was free):
  - On 2fef833 plus the unit fixes: 60 passed, 3 failed, 3 did not run.
    - `a11y.spec.ts:33` failed with /settings `definition-list` (fixed in 7108a07).
    - `sync-roundtrip.spec.ts:63` failed with a test timeout of 120000 ms (fixed in 5fab111/1033f9b).
    - `offline.spec.ts:53` failed with "needs E2E_SERVER=prod"; by design under dev.
  - After 5fab111: 60 passed, 3 failed. `auth-callback.spec.ts:86` and `sync-roundtrip` both failed with `toBeEnabled` failed on a disabled submit (fixed in 1033f9b). The third was `offline.spec.ts:53`, by design.
  - On 1033f9b, two consecutive full runs gave 62 passed, 1 failed (`offline.spec.ts:53`, by design under dev), 3 did not run (offline serial). The no-skips reporter lists those 3 offline tests. All @sync specs pass.
  - Prod step without the sync env: `NEXT_PUBLIC_E2E_HOOKS=1 npm run build && E2E_SERVER=prod PORT=3100 npx playwright test e2e/offline.spec.ts --project=chromium` gave build=0, 4 passed, exit 0.
- Deferred to INTEGRATION step 2 (requests), not merge breakage:
  - G5-02 (CSP `connect-src` from `NEXT_PUBLIC_SUPABASE_URL`), then drop the `bypassCSP`/`serviceWorkers: 'block'` workaround in `sync-roundtrip.spec.ts:29` and `auth-callback.spec.ts:84`.
  - G5-03: `sw.js` `isExcluded` already skips cross-origin; confirm when the workaround is dropped.
  - G5-07 (`E2EHooks.ready`/`bootError` contract, drop `E2EBootHooks` Omit and casts).
  - G5-09 (`test:e2e:offline` npm script; not in package.json yet).
  - G5-10 (workout-store `persist` crash with blocked storage).
  - G5-01/04/05 (G2 `applyRemote` pending-op skip, device clock, backup `accountId`).
  - G4-W2-01 (switch G3 local string tables to `useT`; the drift guard `src/lib/i18n/__tests__/requests.test.ts` passes on the merged tree).
  - G4-W2-05 (`/auth/login` is now 241.7 kB, under budget without the lazy-helpers change).
  - G4-37 §2 dead keys.
  - S3-10 build id.
- Deferred to step 3: the 3 R11 template-literal warnings above. They are false positives on ids and hrefs, and they become errors when `no-literal-string` is raised.
- Unfixed:
  - Login form loses an email typed before hydration.
    - What: `#auth-email` is `autoFocus`, and a user who types before hydration sees the address, but React state stays `''`, so the submit stays disabled. Retyping the same text does not help; they have to change the text.
    - Evidence: the two e2e failures above (trace: hydrated page, no errors, `[disabled]` button with the email shown).
    - Tried: the spec helper only (about 20 min); the product component is unchanged.
    - Proposed fix: in `login-form.tsx`, read the input's DOM value on mount (ref) or on submit (`FormData`), and enable the button from the DOM value.
  - check-bundle `/dashboard` 262.7 kB > 250 kB. Also over: `/workout/active` 279.2, `/exercises/[id]` 270.7, `/workout/debrief` 266.1, `/workout` 265.7, `/analytics` 263.6, `/history/[id]` 263.2, `/settings` 263.0 kB. The cause is the same as step 6 (i18n dictionary chunk). Proposed fix unchanged: lazy non-active locale.
  - Carried from G5-REPORT, not merge breakage, not worked here:
    - stray default profile on a new device;
    - permanently failed ops stay pending;
    - decimal RPE into an `int` column (migration 005);
    - hosted gateway body limit;
    - local Supabase ports bound to 0.0.0.0 (G5 added non-persistent DOCKER-USER drops);
    - S3-06 cursor tiebreaker.
  - Mobile Playwright project not run (chromium only, per the task).


## 8. INTEGRATION step 2: requests (2026-09-27)

Every file under `docs/v2/requests/` was read (61 request files, plus the `repro/` and `G4-W2-01-merge/` helpers) and checked against the merged tree, not against the requests' own status lines: grep for the named symbols, a scratch vitest comparing every local string table and every i18n md table with the dictionary (370 table values identical; md tables: G1 0/G5 0 differences, G3 10 stale md values), and the tests each request names. Base: `82c4acb`; commits `06cce1f`..`61482c7` (15). Same table: `docs/v2/requests/INDEX.md`.

- Port: 3100 was taken by a non-TYTAX process (`paperclipai`, a systemd --user service, pid 2278633 then 2326947; not touched). From 03:37 every Playwright run used `PORT=3110` and `NEXT_PUBLIC_APP_URL=http://localhost:3110`.
- Red-first checks (old code restored in the work tree, run, restored back): G5-02 old CSP → `sync-roundtrip` "reaches device B" fails (`toBeVisible` element not found, the OTP call is blocked); G5-10 old stores → `expected undefined to be defined` (x2); G2 W2 #1 old counts → `skipped: -2`; G5-05 old service → 2 of 3 fail. S3-10 live: an untracked probe file made `E2E_SERVER=prod` refuse with "E2E_SERVER=prod refuses a dirty work tree (tree 61482c7…-dirty-a876f61fe2ff)".
- Test corrections (no assertion weakened): `repo-import-natural-key.test.ts` 2 expectations `updated: 1` → `0` with a comment: counts are file rows only, which is the G2 W2 #1 fix. No test was deleted or skipped.

### Requests

| Request | Outcome | Commit / evidence |
|---|---|---|
| G1-02 training contract (`PrefillOptions.availableKg`, prefill/PR/ACWR semantics) | already done | landed with v2-w2-contracts + v2-g1; G3 passes `availableKg` (G3-W2-02 §3) |
| G1-03 wave0 review handoff: G2 items (R00, R01, R02, S3-11/12/13) | already done | G2 Wave 1, 6e9b8c5 (`review-*` tests) |
| G1-03: G3 items (R03-R06, S3-00..S3-04) | already done | G3 Wave 1 (`wave0-followup-ui.test.tsx`, `workout-foreign-draft.spec.ts`, `program-rotation.spec.ts`) |
| G1-03: G5 items R07-R11, S3-05, S3-07, S3-08, S3-09 | already done | G5 20ef10d and G5-REPORT |
| G1-03: R12 (npm audit high) | already done | G1 3493ecc (overrides); `npm audit --audit-level=high` exit 0 (5 moderate/low left) |
| G1-03: S3-10 (SHA guard ignores working tree) | applied | 61482c7 |
| G1-03: S3-06 (cursor tiebreaker) | already done | `(updated_at, id)` keyset in `src/lib/sync/remote.ts` `pull(…, afterId)` and `lastPulledId` in the cursor store |
| G1-03: G1 items R13-R21 | already done | v2-g1 (station ids, lazy analytics lookup, preset ids, e1RM cap, prefill, ACWR cold start; time sets in Wave 2) |
| G1-04 catalog/presets/engine handoff | already done | consumers adopted (G2 legacy names, G3 `availableKg`, G4 station ids, lookup) |
| G1-W2-01 Wave 2 follow-ups (`rankableE1rm`, `isTimeSet`, station order, program helpers, video links) | already done | `src/lib/db/repo/rows.ts`, `src/hooks/use-pr.ts`, `src/stores/workout-selectors.ts`, G4-16/G4-22 |
| G1-i18n key table (55 rows) | already done | every key in the dictionary with the table's en/hr values (checked with a scratch vitest over the md tables: 0 missing, 0 different) |
| G2-01 profile switch/remove in `E2EHooks` | applied | hooks landed in v2-g5 (G5-08); `profiles.spec.ts` switched in 88791c4 |
| G2-02 settings UI wiring for backup/import/export | already done | G4 UI + c6c45c3 (step 6) |
| G2-W2-01 `NotesRepo.getSetup/setSetup` contract | applied (optional members) | b6941b7; backup schema part already in G2 (`w2-backup-setup-pins`) |
| G2-W2-02 `Repository.wipeAll` contract | applied (optional member) | b6941b7 |
| G2-W2-03 `EquipmentInventory.configuredAt?` | declined | Needs a Supabase column + migration and a mapper entry to survive a sync (`src/lib/sync/columns.ts` whitelists columns; a pulled row would drop it). The list rule plus `bodyweightGear: ['none']` works today. Deferred (Unfixed below). |
| G2 Wave 2 unfixed #1: restore reports a negative `skipped` | applied | dc7f8f1 (red first: `skipped: -2`) |
| G2 Wave 2 unfixed #2: back-dated finish re-derives later logs | declined | working as designed (G2-REPORT); no code change |
| G3-01 `Page`/`Locator` from `e2e/fixtures` | applied | export existed (v2-g5); G3 aliases dropped in 022a904 |
| G3-02 seeded/imported history without PR records | already done | G2 Wave 2 item 2 (`w2-import-prs`) |
| G3-03 e2e hooks (dashboard/preset test ids, `listPRRecords`) | applied | test ids by G4; `listPRRecords` + pr.spec records + dashboard/UI-install rotation e2e in 3fa944f |
| G3-04 foreign draft on dashboard/settings | already done | G4 (step 6 log) |
| G3-i18n key table | already done | all keys in the dictionary; the 10 differing values are the stale md rows G4-W2-01 names (`pr_intro`, `weak_body`, `rest_timer_add30_label`, `rest_timer_stop_label`, `rm_unreliable` now with `{max}`); the live tables won |
| G3-W2-01 machine-setup writer | already done | G2 `NotesRepoExt`; `workout-wave2.spec.ts` "machine setup: saved from the sheet…" is the save test |
| G3-W2-02 hardening notes | already done / no action | §1, §3 done in v2-g3; §2 normaliser bridges ids; §4, §5 informational |
| G3-W2-03 time sets in History + `SeedSetInput.durationSeconds` | applied | 37462c9 (fixture), 8589ded (list hold total + e2e); the detail already rendered durations (G4). Format: History keeps G4's tested `mm:ss` ("00:45"), the workout screens `m:ss` ("0:45"); both unambiguous, not unified |
| G4-01 LocaleProvider hr default + vars | already done | step 7, 9484c41 + c68d603 |
| G4-02 page-heading test ids | already done | nav/a11y specs green |
| G4-03 offline spec on a prod server | applied | CI job by G5; npm script 4daa2ca (G5-09) |
| G4-10 dead `dashboard_*` keys | applied | ec9d0c6 (11 keys; `dashboard_system` still used) |
| G4-15 `ProgramSession.kind` | already done | status DONE in the request (G1 `sessionKind`) |
| G4-16 program helpers | already done | status DONE (G4 imports `@/lib/programs/*`) |
| G4-17 `programs.remove` (hard) + preset descriptions | declined | New repo method + contract + product copy; soft-delete workaround works. Deferred (Unfixed below). |
| G4-20 catalog `stationId`/`attachmentIds` | already done | G1 catalog: 1,328/1,409 exercises carry `stationId`, 302 `attachmentIds` |
| G4-21 per-exercise usage counts | declined | Feature (new repo method + badge + sort), not integration. Deferred (Unfixed below). |
| G4-22 shared video links | already done | status DONE (G1 `buildVideoLinks`) |
| G4-25 `startFromLog` | already done | G3 `workout-store.ts` `startFromLog` |
| G4-26 `logs.update` recomputes PRs | already done | G2 Wave 2 item 1 |
| G4-30 `pinnedExerciseIds` | already done | contract field + G2 whitelist; Supabase `family_members.settings` is jsonb pass-through (migration 002) |
| G4-31 eager catalog in `lib/analytics` | already done | no `@/data` import under `src/lib/analytics` |
| G4-35 import/export API | already done | step 6, c6c45c3; step 4 (drop 2 `data-card` lines) still deferred: the test passes |
| G4-36 equipment "not configured" + device wipe | applied / declined | wipe → G2-W2-02 (b6941b7); `configuredAt` → G2-W2-03 declined |
| G4-37 §1 profile prefs on boot | already done | G4 `ProfilePrefsSync` + provider (step 7) |
| G4-37 §2 dead settings keys | applied | ec9d0c6 (24 keys; `profile`, `warmup_sets` still used) |
| G4-37 §3 onboarding wizard | declined | product feature, not integration; deferred |
| G4-40 LocaleProvider hydration | already done | step 7 (`locale-provider.test.tsx` hr SSR + hydration cases) |
| G4-41 e1RM high-rep cap | already done | G1 option 2 (`rankableE1rm`, `E1RM_MAX_REPS`) |
| G4-47 `prCount` stale after edit | already done | G2 Wave 2 item 1 (`w2-prs-rebuild-all` has the repro) |
| G4-52 picker shows raw pattern | already done | G3 `picker-list.tsx` renders `muscleKey` + modality keys, no raw pattern |
| G4-W2-01 G3/G5 string tables → dictionary | applied | 20b00b3 (hooks read the dictionary; tables kept for the drift test); G5 auth: no change needed |
| G4-W2-05 `/auth/login` first-load JS | already done | `check-bundle`: `/auth/login` 241.1 kB (budget 250) after G5's lazy helpers |
| G4-W2-06 backup service switch | already done | step 6, c6c45c3 |
| G4-W2-07 `settings-account` test id | already done | step 7, 4c29591 |
| G4-W2-15 Repeat workout | already done | G3 `startFromLog`; `repeat-workout.test.tsx` green |
| G4-W2-16 e1RM on time sets | already done | G2 Wave 2 item 4 (`w2-prs-f3-time`) |
| G4-W2-20 `NotesRepo.setSetup` | already done | G2 `NotesRepoExt`; contract member b6941b7 |
| G4-W2-30 analytics lookup/time sets | already done / no action | (b) done by G4; (a) optional |
| G4-W2-40 restore row validation | already done | S3-11 in `importBackup` + zod schema in G2's service; `restore-hardening.test.tsx`, `damaged-log.test.tsx` green |
| G4-W2-45 ACWR clock / per-muscle baseline | no action | fixed on the G4 side; G1 follow-up optional |
| G4-W2-55 clearing a note keeps its setup | already done | G2 `notes.ts` |
| G5-01 `applyRemote` skips pending records | declined (repo level) | See G5-04. |
| G5-02 CSP `connect-src` from `NEXT_PUBLIC_SUPABASE_URL` | applied | 06cce1f; `bypassCSP` removed from both sync specs. Red check: old CSP → `sync-roundtrip` "reaches device B" fails, new → passes |
| G5-03 service worker ignores cross-origin | already done | G4 `sw.js` `isExcluded` (cross-origin first) + new cache names; per-spec SW block removed in 06cce1f, `sync-roundtrip` now runs with the worker allowed and asserts it controls device B before the pull |
| G5-04 `applyRemote` must not compare device time | declined (repo level) | G5's `src/lib/sync/pull.ts` already gives the requested semantics (pending check + apply in one transaction; server wins for records without a queued op), proven by `adapter-conflicts.test.ts` and the live `conflicts.sync.test.ts`. Moving it into `applyRemote` contradicts 3 G2 tests that pin its documented LWW contract (`repo-sync.test.ts` "skips older remote rows, applies newer…" (its profile has a queued op), "…skips equal timestamps"; `repo-apply-remote-guards.test.ts` "a live remote row with the same updatedAt never resurrects a local tombstone") and changes no behaviour for the only caller. Cost of keeping it: one `exportBackup()` per sync run that pulls rows. Deferred (Unfixed below). |
| G5-05 backup must not carry `accountId` | applied | 8b9c03e (service layer: `repo.exportBackup` keeps it because push reads the owner) |
| G5-06 Settings account section with sync off | already done | G4 replaced `AccountSection` with `SyncSlot` (G4-W2-07) |
| G5-07 `E2EHooks.ready: boolean`, `bootError?` | applied | dcdc4c3 |
| G5-08 `E2EHooks` profile methods | already done / applied | hooks in v2-g5; spec switch 88791c4 |
| G5-09 `test:e2e:offline` script | applied | 4daa2ca; `PORT=3110 npm run test:e2e:offline` 4 passed |
| G5-10 stores crash with blocked storage | applied | 0353ea5 (red first: `persist` undefined) |
| G5-i18n key table (42 rows) | already done | all keys in the dictionary, 0 different |
| npm audit high (G1 F5) | already done | 3493ecc; `npm audit --audit-level=high` exit 0 |

### Gate on 61482c7
`npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build`: ci=0 lint=0 tsc=0 test=0 build=0.
```
5 vulnerabilities (1 low, 4 moderate)                # npm ci notice
✖ 3 problems (0 errors, 3 warnings)                  # the same 3 R11 template-literal warnings (step 3)
 Test Files  315 passed (315)
      Tests  2423 passed (2423)
✓ Compiled successfully
```
- `npm audit --audit-level=high`: exit 0.
- `npm run check-bundle`: exit 1, `/dashboard 262.1 kB gzip (budget 250 kB): OVER` (262.7 at step 7; unchanged cause, see step 7 Unfixed). `/auth/login 241.1 kB`: under budget.
- `npm run test:sync` (sync env): exit 0, `Test Files 2 passed (2) / Tests 16 passed (16)`.

### E2E on 61482c7 (sync env, `PORT=3110`)
- `PORT=3110 npx playwright test --project=chromium`: 64 passed, 1 failed, 3 did not run, exit 1. The only failure is `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod" (by design under `next dev`; the 3 did-not-run are its serial siblings). All @sync specs pass without `bypassCSP` or a service-worker block; `sync-roundtrip` runs with the worker in control of device B. New: `program-rotation.spec.ts` UI preset install, `workout-wave2.spec.ts` seeded hold.
- Prod step: `PORT=3110 npm run test:e2e:offline` (the new script: `NEXT_PUBLIC_E2E_HOOKS=1 next build` + `E2E_SERVER=prod`): build ok, 4 passed, exit 0; the content-aware guard accepted the clean tree.

### Deferred / Unfixed (step 2)
- G5-04/G5-01 at the repository level: see the table. The pull-side mitigation stays. Proposed: an optional `applyRemote(table, rows, { serverWins: true })` for the sync path, with G2's LWW tests kept for the default. File as debt S3.
- G2-W2-03 `configuredAt`: needs migration 00x (`equipment.configured_at timestamptz`), a mapper column and the backup schema. File as debt S3.
- G4-17 hard `programs.remove` + preset descriptions, G4-21 usage counts, G4-37 §3 onboarding wizard: product features. File as debt S3.
- G3-W2-03 format: History `mm:ss` vs workout `m:ss`. Cosmetic; S3 if wanted.
- G4-35 step 4 (2 `data-card.test.tsx` lines): unchanged, the test passes (step 6).

## 9. INTEGRATION step 3: coverage thresholds + `no-literal-string` error (2026-09-27)
Base c8fb638. Commits: e16cca1 (coverage), 34eee1b (lint), this log.

### Coverage (e16cca1)
- `vitest.config.ts`: per-glob thresholds `src/lib/**` and `src/stores/**` = lines 70, statements 70, functions 70, **branches 60** (lower on purpose: defensive `??`/`?.` fallbacks on IndexedDB rows count as branches). Global floor unchanged (20/20/15/20). `include` names `src/lib/**/*.ts`, `src/stores/**/*.ts` plus `src/**/*.ts` as before (.tsx still excluded; none live under lib/stores). Newly excluded: `*.test.ts` and `__tests__/**` helpers (test code, e.g. `src/stores/__tests__/g3-helpers.ts`). No product file excluded; no tests needed, every dir was already above 70 %. `json-summary` reporter added.
- Measured (`npm run test:coverage`, exit 0): `src/lib/` lines 98.97, stmts 98.25, funcs 98.36, branches 94.43; `src/stores/` lines 99.49, stmts 97.96, funcs 98.45, branches 95.40; all files 97.31 / 93.04 / 97.11 / 98.40 (stmts/branch/funcs/lines). Lowest dir: `src/lib/sync` lines 90.4, branches 81.1.
- Red check: `src/stores/**` lines set to 99.9 → `ERROR: Coverage for lines (99.48%) does not meet "src/stores/**" threshold (99.9%)`, exit 1; reverted.
- Broke under coverage: `w2-prs-restore-stamp-perf.test.ts` "editing the first of 1000 logs … < 2 s": `expected 2639.92 to be less than 2000` (2 of 2 full coverage runs; passes alone). Measured same edit 427 ms plain, 1499 ms instrumented alone; the CPU profile is dominated by fake-indexeddb (`_findRecords`, `valueToKeyWithoutThrowing`), not app code. Correction (commented in the test): budget stays 2000 ms uninstrumented (`npm test`/gate, and a new plain CI step `npx vitest run …perf.test.ts` after `test:coverage`, since CI runs only the coverage run); under `--coverage` (`TYTAX_COVERAGE` env set by vitest.config.ts from argv) it is 8000 ms, still catching a quadratic regression.

### Lint (34eee1b)
- `i18next/no-literal-string` → `"error"` for `src/**/*.tsx`. The 3 remaining hits were not UI text (DOM ids `sidebar-section-…`, `settings-profile-block-…`, route `/programs/…/session/…`): hoisted to module-level helpers, so no dictionary keys and no per-line disables (`grep no-literal-string src` = 0). Red check: a temp `<p title="Hi">Hello</p>` gives 2 errors, exit 1.
- `coverage/**` added to `globalIgnores` (the v8 HTML report gave an "unused eslint-disable" warning after a coverage run).

### Gate on 34eee1b
ci=0 lint=0 tsc=0 test=0 build=0, test:coverage=0.
```
5 vulnerabilities (1 low, 4 moderate)                # npm ci notice
(lint: no problems; only the Babel >500KB note on scripts/data/source)
 Test Files  315 passed (315)
      Tests  2423 passed (2423)
✓ Compiled successfully
All files          |   97.31 |    93.04 |   97.11 |    98.4 |   # test:coverage
```

### E2E on 34eee1b (sync env, `PORT=3110`: 3100 is held by a non-TYTAX process, paperclip pid 2326947, not touched)
- `PORT=3110 npx playwright test --project=chromium`: 64 passed, 1 failed, 3 did not run, exit 1. Only failure `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod" (by design under `next dev`; 3 serial siblings did not run), same as step 2.
- Prod step `PORT=3110 npm run test:e2e:offline`: 4 passed, exit 0.

### Deferred / Unfixed (step 3)
- None new. Option for later: a relative (not wall-clock) edit-cost check would drop the coverage multiplier.

## 10. INTEGRATION step 4: Final gate (2026-09-27)
Base 2f9a72c. No code changed in this step (only this log). Port: 3100 is still held by a non-TYTAX process (paperclip, pid 2326947, not touched), so every e2e run used `PORT=3110`. Sync env from `npx -y supabase@2.118.0 status -o env` in `app/` (project tytax-v2, API 127.0.0.1:54421).

### Final gate
1. `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build`: ci=0 lint=0 tsc=0 test=0 build=0.
   ```
   5 vulnerabilities (1 low, 4 moderate)                 # npm ci notice
   (lint: no problems; only the Babel >500KB note on scripts/data/source)
    Test Files  315 passed (315)
         Tests  2423 passed (2423)
   ✓ Compiled successfully in 533ms
   ```
2. `npm run test:coverage`: exit 0, 2423 passed. `All files` 97.33 stmts / 93.09 branch / 97.15 funcs / 98.43 lines.
   - Aggregate (json-summary): `src/lib/**` lines 98.97, stmts 98.25, funcs 98.36, branches 94.43; `src/stores/**` lines 99.49, stmts 97.96, funcs 98.45, branches 95.40 (thresholds 70/70/70/60).
   - Per dir (stmts/branch/funcs/lines): `src/lib` (root files) 94.11/92.5/92.85/96.42; analytics 95.58/83.97/97.95/95.67; auth 98.92/93.42/100/100; catalog 94.44/90.6/94/98.05; db 96.39/97.29/91.66/96.77; db/repo 99.38/96.23/99.65/99.77; export 100/100/100/100; i18n 97.82/96.29/100/100; import 98.51/95.39/100/99.22; programs 100/98.9/100/100; supabase 100/100/100/100; sync 96.18/89.43/95.7/97.72; training 98.39/96.08/100/100; workout 100/100/100/100; `src/stores` 97.96/95.4/98.44/99.48.
3. `npm run check-bundle`: **exit 1**.
   ```
   first-load JS for /dashboard: 262.2 kB gzip (budget 250 kB), 17 files
   check-bundle: FAIL
   ```
   No catalog leak on any of 24 routes. Over 250 kB: /workout/active 275.1, /exercises/[id] 268.9, /workout 264.1, /workout/debrief 264.0, /analytics 263.0, /history/[id] 262.7, /settings 262.4, /dashboard 262.2, /analytics/[exerciseId] 259.6, /programs/[id] 258.0, /programs/[id]/session/[sessionId] 258.0, /exercises 254.9. Same cause as steps 6/7/8 (see Unfixed); not fixed here.
4. `npm audit --audit-level=high`: exit 0 (`5 vulnerabilities (1 low, 4 moderate)`, none high; moderate = @vitest/mocker GHSA-82fw-gwwq-j7x9 chain, dev only).
5. `PORT=3110 npx playwright test --project=chromium --project=mobile` (dev server, sync env): exit 1; 128 passed, 2 failed, 6 did not run.
   - chromium: 64 passed, 1 failed, 3 did not run. mobile: 64 passed, 1 failed, 3 did not run.
   - Both failures are `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod" (expected "prod", received undefined): by design under `next dev`; the did-not-run are its 3 serial siblings per project. Every other spec, all @sync specs included, passes in both projects.
6. `PORT=3110 npm run test:e2e:offline` (prod build with E2E hooks, `E2E_SERVER=prod`): exit 0, chromium 4 passed. Extra: same spec `--project=mobile` against the same build: exit 0, 4 passed.
7. Database and sync:
   - `npx -y supabase@2.118.0 db reset`: exit 0 (`Finished supabase db reset on branch v2.`).
   - `npx -y supabase@2.118.0 test db`: exit 0, `Files=9, Tests=789 ... Result: PASS`.
   - `bash supabase/upgrade_test/run.sh`: exit 0, 7 ok, `UPGRADE TEST: PASS`.
   - `npm run test:sync`: exit 0, `Test Files 2 passed (2)`, `Tests 16 passed (16)`, 0 skipped.
8. `PORT=3110 bash scripts/ci-local.sh`: exit 1 (`CI-LOCAL: FAIL`, only check-bundle). e2e job 122 passed; e2e-offline 4 passed; sync-e2e playwright 6 passed.
   ```
   STEP                                     RESULT
   quality: guard .only/.skip               PASS
   quality: npm ci                          PASS
   quality: lint                            PASS
   quality: tsc --noEmit                    PASS
   quality: test:coverage                   PASS
   quality: build                           PASS
   quality: check-bundle                    FAIL
   e2e: playwright install                  PASS
   e2e: playwright chromium+mobile          PASS
   e2e-offline: build (E2E hooks)           PASS
   e2e-offline: playwright install          PASS
   e2e-offline: offline.spec.ts on next start (zero skips) PASS
   sync-e2e: supabase start                 PASS (reused)
   sync-e2e: supabase test db               PASS
   sync-e2e: export env                     PASS
   sync-e2e: test:sync (zero skips)         PASS
   sync-e2e: build (sync on)                PASS
   sync-e2e: playwright install             PASS
   sync-e2e: playwright sync+auth (zero skips) PASS
   security: gitleaks (history)             PASS
   security: npm audit high                 PASS
   CI-LOCAL: FAIL
   ```
9. Zero-skip evidence: `grep -rnE '\b(test|it|describe|suite|bench)(\.(describe|serial|parallel|concurrent|sequential))?\.(only|skip|fixme|todo|skipIf|runIf|fail|fails)\b'` → src 0 hits, e2e 0 hits; `grep -rnE '\.(skip|only|fixme|todo)\('` over src and e2e → 0 hits (a looser `xit\(` pattern only matches `onExit(` in slot-editor.tsx).

### Unfixed (step 4)
- check-bundle `/dashboard` 262.2 kB > 250 kB (PLAN §10.2 AC8; a CI step, so CI `quality` fails). What: same as steps 6/7/8. Evidence: 217.0 kB at 04e4ce5, 259.2 kB after the G4 merge; source-map attribution puts most of it in the i18n dictionary chunk (en + hr and all `modules/*`, ~37.7 kB gzip) that every route loads through `LocaleProvider`/`useT`. Tried: nothing new in this step (the step brief allows code changes only for a real failure; this one is known, and the fix changes locale loading). Proposed fix: load only the active locale up front and import the other one lazily in `LocaleProvider` (the sync `t(key, locale)` in `src/lib/i18n/index.ts` and its English fallback have to become async or be preloaded; roughly 18 kB saved). File as debt S3.

## 11. INTEGRATION step 5: first-load JS budget on every route (2026-09-27)
Base 28f88cb. Commits: `4178790` perf(i18n), `14c7fe8` test(e2e). Port 3110 (3100 is still paperclip, pid 2326947, not touched). Sync env from `npx -y supabase@2.118.0 status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY, MAILPIT_URL, `NEXT_PUBLIC_SYNC_ENABLED=true`, `NEXT_PUBLIC_APP_URL=http://localhost:3110`).

### Measured first (before any change)
- `npm run build && node scripts/check-bundle.mjs` on 28f88cb: exit 1, `/dashboard 262.2 kB`, 12 routes over 250, max `/workout/active 275.1 kB`.
- Per-chunk: one 37.0 kB gzip chunk (`0j2ogcwit9l8u.js`, contains both "Započni trening" and "Start Workout") was in the first load of **all 24 routes**, `/_global-error` included.
- Source-map attribution (scratch build with `productionBrowserSourceMaps`, not committed; each chunk's gzip split over its source files by the mapped bytes) for `/workout/active` (275.6 kB in that build): next + react-dom 136.3, dexie 30.8, `src/lib/i18n/modules/*` 30.8, `src/lib/i18n/*` 6.3 (en.ts/hr.ts core), db/repo 12.4, components/workout 12.2, stores 8.0, rest < 4 each. Dictionary size check (JSON of the objects, gzip): hr 19.7 kB, en 17.8 kB, both 37.0 kB (1478 keys, keys ~8 kB per locale, no cross-locale dedup). So the active-locale-only fix alone (~ -17 kB) would leave `/workout/active` at ~258 kB: not enough.
- Intermediate builds: lazy `en.ts` only, modules still holding both locales → `/workout/active` 273.1 (turbopack kept the en exports of the shared module files); modules split per locale → 259.0 (/dashboard 246.0, still over: `/workout/active`, `/exercises/[id]` 252.8); plus hr packs per screen → 246.1.

### What changed (4178790)
- `src/lib/i18n/index.ts`: first load has only `modules/core.hr.ts` (nav, workout basics, common, errors). English is one lazy chunk (`loadLocale('en')` → `import('./en')`, 17.9 kB gzip). `t()` stays synchronous; for a locale not loaded yet it falls back to hr, then the key (never blank). `registerLocale`, `isLocaleLoaded`, `subscribeLocales` for the provider.
- Every module split into `<m>.en.ts` / `<m>.hr.ts` (hr has a type-only import of en: tsc parity per module); `<m>.ts` re-exports both for tests/tooling. The `core` objects of `en.ts`/`hr.ts` moved to `modules/core.{en,hr}.ts`; `en.ts`/`hr.ts` still export the full dictionaries (server, tests).
- hr packs: `src/lib/i18n/packs/<m>.ts` registers `<m>Hr`; every file that uses a key of that module imports the pack (157 files, added by `npx tsx scripts/i18n-packs.ts --fix`). `scripts/i18n-packs.ts` finds usage with the TypeScript AST: exact literals, plural bases (`L` with `L_other`), prefix literals (`'muscle_'`), template literals (`` `dash_sets_${cat}` ``), ignoring type positions and import specifiers. `src/lib/i18n/__tests__/packs.test.ts` runs it in `npm test` (missing or unneeded pack import = fail), checks that core + packs own every hr key once, and that each pack registers its strings. Red check: deleting the g3Workout pack import from `set-row.tsx` fails the test with `components/workout/set-row.tsx: missing [g3Workout]`.
- `LocaleProvider`: `locale` = stored/chosen locale only once its dictionary is loaded (`useSyncExternalStore(subscribeLocales, …)`, server snapshot true), otherwise hr; an effect loads it; a failed load keeps hr and logs `locale load failed`. SSR and the hydration pass render hr (DEFAULT_LOCALE) as before, so no English flash and no hydration mismatch. `global-error.tsx` does the same. Server metadata (`page.tsx` files) uses `src/lib/i18n/dictionaries.ts` (both locales, server/tests only).
- `src/test-setup.ts` registers the full hr and en dictionaries (unit tests render single components in either language synchronously, as before). New tests with a fresh module registry: `src/lib/i18n/__tests__/lazy-locale.test.ts` (only hr at start, fallback, one shared request, subscribers notified, failure rejects and retry works, index.ts imports no full dictionary), `src/components/providers/__tests__/locale-provider-lazy.test.tsx` (stored en: SSR + hydrate with 0 recoverable errors, then en; switch persists at once and stays hr until the held-back chunk arrives; failing chunk keeps hr and logs). Red check: `const locale = wanted;` in the provider fails all 3 lazy provider tests. The hr/en key-parity tests are unchanged (they import `translations` from `dictionaries.ts` now).
- `scripts/check-bundle.mjs --budget-all-routes`: every scanned route is held to the budget (new test in `scripts/__tests__/check-bundle.test.ts`); `npm run check-bundle`, `.github/workflows/ci.yml` and `scripts/ci-local.sh` use it. Default CLI behaviour (budget route only) is unchanged.
- `e2e/offline.spec.ts` (14c7fe8): "switching to English works offline although English was never used online": prime online in hr, go offline, switch language in Settings, heading "Settings" + `lang=en`, offline reload keeps English. The first version set `localStorage.locale='en'` and reloaded; it failed on the prod build because `ProfilePrefsSync` re-applies the active profile's language (hr) at boot (instrumented build: `setLocale('hr')` ~20 ms after en rendered). Red check (scratch spec, not committed): with the en chunk deleted from the worker cache the heading stays "Postavke". `public/sw.js` needed no change: the en chunk is named in the loader code of a first-load chunk (`"static/chunks/<en>.js"`), which `cacheChunksDeep` follows.
- CHANGELOG (Unreleased, Changed) and `src/lib/i18n/modules/README.md` updated.

### Gate on 14c7fe8
`npm run lint && npx tsc --noEmit && npm test && npm run build`: lint=0 tsc=0 test=0 build=0.
```
 Test Files  318 passed (318)
      Tests  2451 passed (2451)
✓ Compiled successfully in 589ms
```
`npm run test:coverage`: exit 0, `All files 97.34 / 93.05 / 97.12 / 98.42`; `src/lib/i18n` 97.43 / 91.89 / 96.29 / 98.57.

### `npm run check-bundle` on 14c7fe8: exit 0 (`--budget-all-routes`)
| route | before 28f88cb (kB gz) | after 14c7fe8 (kB gz) | Δ |
|---|---|---|---|
| `/` | 233.9 | 200.9 | -33.0 |
| `/_global-error` | 170.9 | 138.1 | -32.8 |
| `/_not-found` | 233.9 | 200.9 | -33.0 |
| `/analytics` | 263.0 | 232.3 | -30.7 |
| `/analytics/[exerciseId]` | 259.6 | 228.9 | -30.7 |
| `/auth/account` | 245.0 | 212.0 | -33.0 |
| `/auth/login` | 241.1 | 208.1 | -33.0 |
| `/dashboard` | 262.2 | 230.8 | -31.4 |
| `/exercises` | 254.9 | 225.3 | -29.6 |
| `/exercises/[id]` | 268.9 | 242.0 | -26.9 |
| `/history` | 250.5 | 219.2 | -31.3 |
| `/history/[id]` | 262.7 | 233.5 | -29.2 |
| `/history/[id]/edit` | 252.9 | 221.6 | -31.3 |
| `/programs` | 253.5 | 224.1 | -29.4 |
| `/programs/[id]` | 258.0 | 228.4 | -29.6 |
| `/programs/[id]/session/[sessionId]` | 258.0 | 229.6 | -28.4 |
| `/programs/new` | 248.0 | 218.3 | -29.7 |
| `/settings` | 262.5 | 233.9 | -28.6 |
| `/tools` | 245.4 | 213.1 | -32.3 |
| `/tools/plate-calculator` | 247.2 | 214.9 | -32.3 |
| `/tools/rm-calculator` | 247.5 | 215.2 | -32.3 |
| `/workout` | 264.1 | 233.1 | -31.0 |
| `/workout/active` | 275.1 | 245.6 | -29.5 |
| `/workout/debrief` | 264.0 | 232.4 | -31.6 |
```
first-load JS for /dashboard: 230.8 kB gzip (budget 250 kB), 16 files
check-bundle: OK        # every route "budget 250 kB: ok", catalog leak: no on all 24
```
Largest route `/workout/active` 245.6 kB (4.4 kB headroom).

### E2E on 14c7fe8 (sync env, `PORT=3110`)
- `npx playwright test --project=chromium --project=mobile` (dev server): exit 1; 128 passed, 2 failed, 8 did not run. Both failures are `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod" (by design under `next dev`); did-not-run = its 4 serial siblings per project (one more than step 4: the new English test). All @sync specs pass.
- `npm run test:e2e:offline` (prod build, E2E hooks): exit 0, chromium 5 passed (new English test included). Extra: `E2E_SERVER=prod npx playwright test e2e/offline.spec.ts --project=mobile` on the same build: exit 0, 5 passed.
- On 4178790 the same dev run was done twice: first run 127 passed, 3 failed: the 2 by-design offline failures plus `[mobile] profiles.spec.ts:114` "two profiles see only their own history" (`window.__tytaxE2E is missing` in `tytax.snapshot()` right after a bare `page.reload()`). Not reproduced: `profiles.spec.ts --repeat-each=5` both projects 20/20 passed, second full run and the 14c7fe8 run clean. See Unfixed.

### Unfixed (step 5)
- Flake (S3, test): `profiles.spec.ts:114` calls `tytax.snapshot()` after `page.reload()` without waiting for `__tytaxE2E` (`gotoApp`/`waitReady` do wait); 1 failure in 3 full dev runs, 0 in 20 isolated runs. Proposed fix: `snapshot()` (and the other hook calls) wait for the hooks the way `waitReady` does, or the spec uses `waitReady` after reload. Not changed here: not reproducible on demand and outside this step.
- Observed once, not reproduced: `legacy-import.integration.test.tsx` and `restore-confirm.test.tsx` timed out (`toBeEnabled`) in a partial `vitest run src/lib/i18n src/components` under load; passed on rerun and in all 4 full `npm test` runs.
- Headroom is 4.4 kB on `/workout/active`. Next levers if it shrinks: `src/lib/auth/i18n.ts` still ships `AUTH_STRINGS` (en + hr, ~1.2 kB gz on every route) as a fallback although every auth key is in the dictionary; `next/dynamic` for closed workout sheets (picker, swap, setup).

## 12. INTEGRATION step 6: refuter findings (2026-09-27)

14 reproduced findings (R1 data/sync, R2 loop/UI), 0 dropped. Each fix has its own commit and a test that failed on the code before the fix and passes after. The red run was done by reverting only the fix's source files (`git diff > patch; git checkout -- <files>; vitest; git apply patch`), with the new test in place.

### Refuters

| # | Sev | Finding | Outcome | Commit | Test (red before → green after) |
|---|---|---|---|---|---|
| 1 | S2 | Account switch mid-push dead-letters the op as `permanent:42501`; the next pull overwrites the unsent edit | fixed: on a 42501 the push re-reads `currentAccountId()`; a changed/signed-out session stops the run with the retryable `account_changed` and the op stays live; a 42501 under the same session is still permanent; a failing re-read is `network` | ae88a3b | `src/lib/sync/__tests__/adapter-account-switch.test.ts` (3 of 4 red before; the "same session still dead-letters" case is the guard) |
| 2 | S2 | v2->v3 upgrade throws on malformed legacy shapes; DB stuck at v2 | fixed: `recordsOf()`/`Array.isArray` for log exercises, sets, program sessions and session exercises, `plateSet` of a non-array | f298a52 | `src/lib/db/__tests__/migration-edge.test.ts` "malformed legacy shapes complete the upgrade" (8 cases red before). The rollback test now injects its throw through `vi.mock('../migrations/log')` because `exercises:[null]` no longer throws; its assertions (v2 intact, no `meta` store, same dump) are unchanged |
| 3 | S3 | `finishWorkout` returns a tombstone as `alreadyFinished:true`; the draft is discarded | fixed: `CONFLICT` "Workout <id> was deleted", nothing written; the debrief keeps the draft and shows its error (discard stays possible). Chose CONFLICT over undelete: the tombstone is a deliberate delete of this same workout | e24b290 | `src/lib/db/__tests__/finish-tombstoned-id.test.ts` (2 of 3 red before) |
| 4 | S3 | Edits made with the sync adapter disabled queue no op and are overwritten by the next pull | fixed: `WriteScope.queue/queueMany` queue ops for any profile an account has claimed, whatever the adapter; never-synced profiles queue nothing (one `bulkGet` per write, no extra await on a cached answer: ZONE_ECHO_LIMIT) | d3bd06c | `src/lib/sync/__tests__/sync-off-edits.test.ts` (red before). `adapter-push.test.ts` "data written while sync was off" asserted the defect (outbox 0, a sync-off write after the first sync never reaches the server): now asserts ops are queued and the second row is pushed (2 rows, outbox 0) |
| 5 | S3 | Family member without `createdAt` → v3 row fails `parseBackupV3` | fixed: `strOr(member.createdAt, ctx.now)` for createdAt/updatedAt | 6b869cf | `src/lib/db/migrations/__tests__/restorable-backup.test.ts` last case (red before) |
| 6 | S3 | `repo.importBackup` stores own `__proto__` keys from pre-parsed input | fixed: `validateBackup` walks every row (iterative) and throws VALIDATION on an own `__proto__`/`constructor`/`prototype` key, before the first write | 5097669 | `src/lib/db/__tests__/repo-import-unsafe-keys.test.ts` (3 of 4 red before) |
| 7 | S3 | Forced upgrade re-run over injected v2 programs re-points `activeProgramId` | fixed in code (not the comment): a v3 profile keeps an `activeProgramId` naming a live program of its own; only a missing/dangling one takes the legacy winner | 28e42e2 | `src/lib/db/__tests__/migration-dexie.test.ts` two new re-run cases (the keep case red before) |
| 8 | S2 | Dashboard "start today" builds a different draft than /workout | fixed: `useStartWorkout` runs the orchestrator's `prepareProgramStart`/`startProgram` with the same `useProgramStartFlow` offer dialogs (rendered once on the dashboard page); `program()` takes no argument (today's session of the active program). `page-client.robustness.test.tsx` calls updated from `start(program)` to `start()`, assertions unchanged | 41f9ad4 | `src/app/(app)/dashboard/__tests__/start-parity.test.tsx` (both red before: warm-ups + snapshot + equality with the orchestrator draft; deload offer then `isDeload`), e2e `progression.spec.ts` "starting today's program session from the dashboard generates warm-ups" (chromium + mobile) |
| 9 | S2 | History editor refuses >100 reps | fixed: one constant `MAX_SET_REPS = 1000` (`src/lib/constants.ts`) for the editor and the draft validator; an untouched stored count never blocks a save | 901e5b7 | `src/components/history/__tests__/edit-model-reps-cap.test.ts` (4 red before) |
| 10 | S3 | >1000 reps silently deleted on rehydrate | fixed: reps `NumberField max={MAX_SET_REPS}` and `updateSet` clamps. `sanitizeDraft` still drops a set above the cap (`hardening.test.ts` asserts that for a 1e9-rep row from hand-edited storage); the app no longer writes one | aad76de | `src/stores/__tests__/reps-cap.test.tsx` (2 red before) |
| 11 | S3 | lb-entered weight shows a 17-digit float in kg mode | fixed: `kgToDisplay` rounds kg to 0.01 (not 0.1: 1.25 kg plates); the set-row kg field gets `matchTolerance` 0.005 so a typed third decimal is not rewritten | 3f81c38 | `src/lib/__tests__/utils.test.ts` new case, `src/components/workout/__tests__/set-row-kg-display.test.tsx` (display case red before the rounding; typed-decimals case red with rounding but without the tolerance) |
| 12 | S3 | Debrief volume raw kg, no unit, no locale format | fixed: `formatWeight(volumeKg, units, locale)`; the debrief page passes `settings.units`. The two existing volume assertions in `debrief-page.test.tsx` now expect `'1,140 kg'` (was the substring `'1140'`) | 13cf0ae | `debrief-page.test.tsx` new lb case (red before) |
| 13 | S3 | Catalog load failure: a hold without ghost/duration is painted and logged as reps, no retry | fixed: a failed load retries on `online`/`visibilitychange`; every successful load records the catalog's time ids in a device cache (`src/stores/measure-cache.ts`, localStorage, union only) that `measureOfExercise` consults before the set heuristic | dbe4806 | `src/hooks/__tests__/use-workout-catalog-failure.test.ts` (2 red before) |
| 14 | S3 | Finish advances the rotation from the pointer, not the trained session | fixed: `advanceIn(ctx, w, program, draft.programSessionId)` advances to the session after the trained one when the program still has it, else after the pointer; contract comment updated | f912560 | `src/lib/db/__tests__/finish-advance-from-trained.test.ts` (2 of 3 red before; the fallback case is the guard) |

Not fixed (partial), with the proposed fix:
- #1, second half of the suggestion (keep dead-lettered keys in `pendingRecordKeys` so a pull cannot overwrite a rejected edit): not done. `outbox-ops.ts` documents the opposite on purpose ("their change was rejected, so the server copy may win"); flipping it would pin a permanently rejected row against every newer server copy. The account-switch path no longer dead-letters, which removes the loss this finding reproduced. Proposed if wanted: surface dead letters in the sync panel with a "keep mine / take server" choice.
- #8: `workout-store.startFromProgram` still exists (store API, own tests) but no screen calls it any more. Proposed: remove it or make it delegate to `buildSessionExercise` in a follow-up.
- #13 residual: a device that has never loaded the catalog (no cached ids) and whose first catalog load fails still measures a ghostless hold as reps until the retry succeeds. Proposed: persist the measure on the `SessionExercise` at draft creation (optional contract field; `parseBackupV3` and the sync mapper must accept it first).

Dropped (not reproduced): none (the list was empty).

### The refuters' own repros on the fixed code
- R1 `s6-cross-account` 3/3, `proto/pollution` 3/3 pass.
- R1 `tests/migration`: 39/42. The 3 left assert the old behaviour: the A2 rollback probes (`missing-exercises`, `plate-weights-string`) expect the upgrade to reject, it now completes; the family-member probe expects `hasCreatedAt: false`, the row now has `createdAt` and `parseErr` is null as it wanted.
- R1 `tests/finish` T4/T4b: fail by design of the chosen fix (they wanted an undelete; the finish now throws CONFLICT and the tombstone stays).
- R1 `mysync/sync-off-edit`: fails at its precondition `no op queued while disabled: expected 1 to be +0`; the fix is that op.
- R2 `probe-b` calls `store.startFromProgram` directly (a copy of the old dashboard code), so it still differs; the dashboard no longer uses that path (start-parity test).
- R2 `probe-d` "renders the stored kg" and `probe-own` expect 0.1 rounding (`61.2`); the fix rounds to 0.01 (`61.24`).
- R2 `probe-h` "follows the profile unit" renders `DebriefSummary` without a `units` prop; the page passes it. "is measured as reps" runs with a pending catalog and an empty cache: the #13 residual above.

### Gate on f912560
`npm run lint && npx tsc --noEmit && npm test && npm run build`: every step exit 0.
```
lint rc=0
tsc rc=0
test rc=0   Test Files 328 passed (328), Tests 2492 passed (2492)
build rc=0
```
One run of a partial `vitest run src/components src/lib/__tests__` under load had `legacy-import.integration.test.tsx` and `restore-confirm` time out on `toBeEnabled` (the step-5 observation again); `vitest run src/components/settings` right after: 99/99, and the full `npm test` above passed.

### `npm run check-bundle` on f912560: exit 0
`/dashboard` 238.6 kB gzip (was 230.8, +7.8 kB: the orchestrator, session builder and offer dialogs now on the dashboard, 17 files), `/workout/active` 246.6 kB (was 245.6; 3.4 kB headroom), `/workout/debrief` 233.1, every route "budget 250 kB: ok", catalog leak: no on all 24.

### E2E on f912560 (sync env from `supabase status -o env`, `PORT=3110`, `NEXT_PUBLIC_APP_URL=http://localhost:3110`)
- `npx playwright test --project=chromium --project=mobile` (dev server): exit 1; 130 passed (128 + the new dashboard warm-up test in both projects), 2 failed, 8 did not run. Both failures are `offline.spec.ts:53` "offline.spec needs E2E_SERVER=prod" (by design under `next dev`); did-not-run = its 4 serial siblings per project.
- `npm run test:e2e:offline`: exit 0, chromium 5 passed. `E2E_SERVER=prod npx playwright test e2e/offline.spec.ts --project=mobile`: exit 0, 5 passed.
- `npm run test:sync`: exit 0, 2 files, 16 tests passed.

## 13. INTEGRATION step 5: critic gate + Terra (2026-09-27)

Scored artifact: `git diff main...v2` over the G5/integration scope (supabase, src/lib/{sync,auth,supabase}, src/proxy.ts, src/app/{auth,api}, src/components/{providers,sync}, .github, scripts/ci-local.sh, eslint/playwright/vitest configs, e2e/fixtures, next.config.ts, public/sw.js). Full diff 879,705 bytes; the artifact omits the 9 generated pgTAP files (`supabase/tests/generate.py`, which writes them, stays in) and the bodies of the 10 deleted files (old `/api/{sync,profile,workout}` routes, `engine.ts`, `queue.ts` and their own tests: the code under test is gone), listing both in its header. Built by `scratchpad/critic/build.sh`. Job `tytax-v2`, critic `terra`, author `claude-opus`.

### Round 1: REJECTED 2/10 (security 2, completeness 2, risk 3; 3/3 quotes verified, 0 counted blockers)
- D1 `public/sw.js` caches same-origin navigations by pathname "without considering credentials"; asked for an account-switch regression test. Verified: not reproducible. Every shell route is prerendered static (`.next/prerender-manifest.json` lists all 12 `SHELL_ROUTES`), no page, layout or route outside `src/app/auth` imports `next/headers`, `@/lib/supabase/server` or `@supabase/ssr` (only `src/app/auth/callback/route.ts` reads cookies), and user data lives only in IndexedDB. The cached HTML is the same for every account. Pinned by `src/__tests__/sw-cache-user-independent.test.ts` (14 tests; runs the real `public/sw.js` in a vm): `/auth/**`, `/api/**` and cross-origin Supabase requests are never intercepted, `CACHE_URLS` cannot smuggle them in, and the import ban above holds. 7bb8475.
- D2 migration 002 section h (and the section d reference repair) rewrote existing data irreversibly. Real. Fixed: `public.migration_repair_archive` (RLS on, no grants, `on delete cascade` with the account, PK + `on conflict do nothing`) receives every original value before `pg_temp.repair` rewrites it. `supabase/README.md` has the preflight count query and the restore statement. `supabase/upgrade_test/assert_upgraded.test.sql` +10 assertions (red before: `relation "public.migration_repair_archive" does not exist`); pgTAP `00_schema` +3. 4b7a03f.

### Terra pass (`lane terra --effort high`, the same artifact): 4 findings
| # | Sev | Finding | Disposition |
|---|---|---|---|
| T1 | S1 | `public/sw.js:199` navigation cache can replay Alice's authenticated HTML to Bob | Same as critic D1: not reproducible (static prerendered HTML, no server session reads outside `/auth`); invariant test 7bb8475 |
| T2 | S1 | `004_v2_quotas.sql:147` `pg_column_size(n.*)` misses TOASTed values, so the 64 MiB quota can be bypassed | False, measured: 5 `workout_logs` rows whose `exercises` is 7,000 md5 strings (1,260,020 bytes stored, TOASTed) raised `sync_usage.byte_count` by 1,260,705. A whole-row datum inlines out-of-line values, so the charge covers them at stored size |
| T3 | S2 | `outbox-ops.ts:12` `MAX_PEEK` 6,400: that many dead letters or other-account ops hide every live op | Real. Fixed: the window widens until PEEK_LIMIT live ops or the outbox ends. `backlog.test.ts` 2 tests red before (`expected [] to deeply equal ['op-99999']`). 715e7d8 |
| T4 | S2 | `adapter.ts:23` a backlog over 50×200 ops ends the run `idle` with no follow-up | Real. Fixed: a run whose last allowed round still settled ops schedules a follow-up run (`maxPushRounds` option for tests). `backlog.test.ts` red before (`expected 0 to be greater than 0`: no timer armed). 715e7d8 |

### Checks after the fixes (7bb8475)
- `supabase/upgrade_test/run.sh`: UPGRADE TEST: PASS (002: 24/24, 003: 17/17, 004: 7/7).
- `npx -y supabase@2.118.0 db reset && npx -y supabase@2.118.0 test db`: Files=9, Tests=792, Result: PASS.
- Gate: lint rc=0, tsc rc=0, test rc=0 (Test Files 330 passed, Tests 2510 passed; was 2492, +18 new), build rc=0.

### Round 2: REJECTED 3/10 (security 3, completeness 2, risk 3, evidence 8; both round-1 defects confirmed fixed)
- D1 no request-body limit before the caps: "column caps, a 200-row SQL trigger, and a 64 MiB account quota execute only after the gateway/PostgREST has accepted and parsed the body". Real, measured: a 4.5 MB, 150-row upsert to `bodyweight_entries` was accepted (HTTP 201). Fixed:
  - migration `005_v2_request_limit.sql`: `public.request_guard()` as PostgREST `db-pre-request` (role setting on `authenticator`, loads with `notify pgrst`), POST/PATCH/PUT above `public.request_body_limit()` = 4 MiB -> `PT413`/413, missing `Content-Length` -> `PT411`/411, reads pass. Probe through Kong: 5,265,002-byte body -> 413 `request body is 5265002 bytes (max 4194304)`; the same body sent chunked -> 413 (the gateway buffers and sets Content-Length). 5974657.
  - client: `chunkRanges()` splits every upsert at 100 rows or 2 MiB of UTF-8 JSON (`MAX_PUSH_BYTES`). e85356e.
  - tests: `push-bytes.test.ts` 6 (all red before), pgTAP `09_request_limit` 18, live `request-limit.sync.test.ts` 4 (with the role setting reset: 3 red, `expected 201 to be 413`), `upgrade_test` extended to 005 (5 assertions, twice-applied) and now a step of the CI `sync-e2e` job and of `scripts/ci-local.sh`.
  - Residual, stated in `supabase/README.md`: Kong and PostgREST still receive the body before the guard; a byte cap at that layer is a Supabase platform setting outside the repo.

### Checks after round 2 fixes (5974657)
- `supabase db reset` (001-005 from scratch) + `supabase test db`: Files=10, Tests=810, PASS. `upgrade_test/run.sh`: PASS (002 24, 003 17, 004 7, 005 5).
- `npm run test:sync` (sync env): Test Files 3 passed, Tests 20 passed.
- Gate: lint rc=0, tsc rc=0, test rc=0 (331 files, 2516 tests), build rc=0.

### Round 3: REJECTED 2/10 (correctness 4, security 3, completeness 3, risk 2, evidence 8)
- D1 (again) the guard "is not a Kong/API-gateway body-size cap"; asked for a gateway limit on local and hosted Supabase. Not fixable in this repo, with evidence: the local gateway is `public.ecr.aws/supabase/kong:2.8.1`, created by the Supabase CLI, whose `/usr/local/kong/nginx-kong.conf` has `client_max_body_size 0`; `supabase/config.toml` (CLI 2.118.0) has no key for it (its only size keys are `max_rows` and storage `file_size_limit`); the hosted gateway is a Supabase platform setting, and cloud Supabase is out of bounds for this run. 005 is the in-repo bound: PostgreSQL never parses an oversized body. Recorded as a residual in `supabase/README.md` and `docs/v2/critic-verdict.md`.
- D2 a pull mapping failure is "treated as a successful skip ... and the cursor advances" (legacy rows whose `family_member_id` 002 nulls). Real. Fixed: the first unmappable row holds the persisted cursor before it for the rest of the run, so later runs re-read it and it lands once it maps; everything after it is still applied in the same run. `pull-invalid.test.ts` red before (`expected ['2026-03-01','2026-03-03'] to deeply equal [...,'2026-03-02',...]`). Residual: a legacy row with a null `family_member_id` stays unmappable until the server assigns it a family member (proposed follow-up: a repair migration that creates one recovery family member per affected account and points those rows at it, archived like 002's repairs).

### Checks after round 3 fixes
- `npm run test:sync`: 3 files, 20 tests passed. Gate: lint rc=0, tsc rc=0, test rc=0 (332 files, 2517 tests), build rc=0.

### Round 4: REJECTED 2/10 (correctness 6, security 2, completeness 3, risk 2, actionability 4)
- D1 (third time) gateway body cap on local and hosted Kong. Unchanged disposition: outside the repo (see round 3). Residual.
- D2 "partially fixed": held rows still ended the run as a successful sync. Fixed: `pullRun` reports rows it could not map; the adapter ends that run `error` / `invalid_row` with no `lastSyncedAt`, explained in the sync panel (`sync.error.invalid_row`, en + hr, request row in `docs/v2/requests/G5-i18n.md`). `pull-invalid.test.ts` and `sync-panel.test.tsx` red before. d5628ba. Not done (proposed follow-up): the server-side rehome of legacy null-`family_member_id` rows to a recovery family member (a data-repair migration that also changes the 002 upgrade-test expectation `cross-account workout_logs.family_member_id repaired to null`).
- Checks on d5628ba: `npm run test:sync` 3 files / 20 tests passed; gate lint rc=0, tsc rc=0, test rc=0 (332 files, 2517 tests), build rc=0.

### Round 5: not scored (critic-gate exit 11, stalled), best = round 2 (REJECTED 3/10)
`critic-gate ... --round 5` refused the call: "the last two recorded rounds did not improve on an earlier round". `critic-gate --job tytax-v2 --best`: seq 2, round 2, REJECTED 3/10. Its gap is the gateway body cap (outside the repo). Verdict, rounds table, Terra dispositions and the two unfixed items with proposed fixes: `docs/v2/critic-verdict.md`.

### Final checks (d5628ba, docs after)
- `npm run check-bundle`: OK (`/dashboard` 238.7 kB gzip, `/workout/active` 246.7 kB, all routes within 250 kB, no catalog leak).
- `npx playwright test --project=chromium --project=mobile` (dev server, sync env, `PORT=3110`): 130 passed incl. `@sync` round trip; 2 failed = `offline.spec.ts:53` "needs E2E_SERVER=prod" (by design), 8 did not run (its serial siblings).
- `npm run test:e2e:offline`: exit 0, 5 passed (chromium). `E2E_SERVER=prod npx playwright test e2e/offline.spec.ts --project=mobile`: exit 0, 5 passed. (A first attempt refused on the tree guard, "E2E_SERVER=prod refuses a dirty work tree", because this log was uncommitted; rerun after f6697f7.)
