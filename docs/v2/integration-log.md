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
