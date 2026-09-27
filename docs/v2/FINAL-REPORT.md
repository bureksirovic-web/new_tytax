# TYTAX v2: final report (GOALS.md G5 INTEGRATION step 6)

## 1. Header

- **Branch** `v2` in `~/Projects/tytax-v2/app`. **HEAD at the proving runs:** `f75babb28a82f4bfe1813a6f9f9620e0a6fbc309` ("docs(integration): critic verdict for step 5"). The commits after it are docs only: `d3bb596` adds this report and `docs/v2/ISSUES-TO-FILE.md`, and the next one applies the review corrections to both and redacts host details in `docs/v2/goals/G5-REPORT.md` and `docs/v2/integration-log.md`.
- **Date:** 2026-09-27. The proving runs in §2 were made 06:04 to 06:11 CEST on that HEAD, with a clean work tree.
- **Merged into `v2`** (`git merge --no-ff`, in this order, no conflicts; details in `docs/v2/integration-log.md` §1 to §7):

  | Branch | Tip merged | Merge commit on `v2` |
  |---|---|---|
  | `v2-wave0` | `0cfb58e` | `297a033` |
  | `v2-w2-contracts` | `7c8e087` | `9b395ea` |
  | `v2-g1` | `fb06355` | `ccb9ba5` |
  | `v2-g2` | `dfea4ec` | `c5f41ce` |
  | `v2-g3` | `ef28ec0` | `4e5a7e0` |
  | `v2-g4` | `63961e8` | `1f33b2d` |
  | `v2-g5` | `7490d3a` | `2fef833` |

  After the merges: requests (§8), coverage and lint thresholds (§9), final gate (§10), bundle budget (§11), refuter fixes (§12), critic gate and Terra fixes (§13). `git log --oneline main..v2 | wc -l` = 197.
- **Nothing is merged to `main`.** `main` is `bdaea46` on origin, unchanged. `v2` was pushed after the proving runs and PR #45 (`v2 → main`) is open, not merged; its CI is green (see AC16 and §8).
- **Nothing is deployed.** No tag was made. Render and cloud Supabase were not touched. Only the local Supabase stack (`project_id tytax-v2`, ports 5442x) was used.

Environment for every e2e and sync command below: `eval "$(npx -y supabase@2.118.0 status -o env | sed 's/^/export /')"`, then `NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY NEXT_PUBLIC_SYNC_ENABLED=true PORT=3110 NEXT_PUBLIC_APP_URL=http://localhost:3110`. Port 3100 (the planned integration port) is held by an unrelated local service, so 3110 was used.

## 2. Acceptance criteria AC1 to AC18

Every excerpt below comes from a fresh run on `f75babb`, except four re-runs made at 06:16–06:18 on `d3bb596` (the docs-only commit that adds this report, so the product code is identical to `f75babb`): the mobile e2e run without `--grep-invert @sync` (AC3, AC9, AC12 and the e2e summary below), the PR-specific unit files (AC6), the auth missing-env unit tests (AC13) and the raw `gh` listings (AC17). The logs lived in the session scratchpad, which is not kept, so the excerpts pasted here are the durable record; each command below re-creates its log.

**Summary: 17 MET, 1 PARTIAL (AC17: archiving tytax-autonomous is an owner step), 0 NOT MET.** AC12 and AC16 were confirmed by the GitHub Actions run on PR #45.

| AC | Status | Proving command | Output excerpt (fresh) |
|---|---|---|---|
| AC1 checks green | **MET** | `npm ci && npm run gate` (gate = `npm run lint && tsc --noEmit && npm test && npm run build`) | `npm ci` rc=0 (`5 vulnerabilities (1 low, 4 moderate)`); gate rc=0: lint prints no problems (only the Babel ">500KB" note on `scripts/data/source`), `Test Files 332 passed (332)`, `Tests 2517 passed (2517)`, `✓ Compiled successfully in 694ms` |
| AC2 coverage ≥ 70 % lines on `src/lib/**`, `src/stores/**` | **MET** | `npm run test:coverage` (thresholds in `vitest.config.ts`: 70 lines/stmts/funcs, 60 branches per glob), then an aggregate over `coverage/coverage-summary.json` | rc=0, `All files 97.39 / 93.08 / 97.24 / 98.45` (stmts/branch/funcs/lines). Aggregates: `src/lib/** files 213 lines 98.93% (4056/4100) branches 94.47%`; `src/stores/** files 17 lines 99.51% (605/608) branches 95.36%` |
| AC3 quick workout, fresh profile | **MET** | `npx playwright test --project=chromium` (full suite; spec `e2e/workout-quick.spec.ts`), and `npx playwright test --project=mobile` | chromium: `✓ e2e/workout-quick.spec.ts:18:5 › quick workout logs three sets, survives a reload and is saved with its debrief (8.4s)`. mobile: `✓ 63 [mobile] › e2e/workout-quick.spec.ts:18:5 › quick workout logs three sets, survives a reload and is saved with its debrief (8.4s)`. Zero `test.skip` in the spec (grep row below) |
| AC4 program workout | **MET** | same run, `e2e/program-rotation.spec.ts` | `✓ …:94:5 › installing the TYTAX preset through the programs UI names its first session on the dashboard`; `✓ …:14:5 › finishing the first program session advances /workout to the second`; `✓ …:64:5 › a rest session is completed from /workout and the rotation wraps to the first session` |
| AC5 progression | **MET** | `npx vitest run progression`; e2e `e2e/progression.spec.ts` | unit `Test Files 1 passed (1) Tests 14 passed (14)`; e2e `✓ RIR 3 adds 2.5 kg, RIR 2 adds 1.25 kg, and ghost reps mark a beaten set`, `✓ standard / heavy / pyramid warm-up strategy generates 2 / 4 / 3 warm-up sets`, `✓ 'none' warm-up strategy adds no warm-ups…`, `✓ starting today's program session from the dashboard generates warm-ups, as /workout does` |
| AC6 PRs | **MET** | `npx vitest run` on the 13 PR-specific files: `src/lib/training/__tests__/prs.test.ts`, `src/lib/analytics/__tests__/pr-tracker.test.ts`, `src/hooks/__tests__/use-pr-celebrated.test.ts`, `src/lib/db/__tests__/{finish-workout-pr-history,review-r01-pr-live-logs,w2-import-prs,w2-prs-chains,w2-prs-f3-time,w2-prs-rebuild,w2-prs-rebuild-all,w2-prs-restore-stamp-perf}.test.ts`, `src/lib/import/__tests__/{legacy-import-service-prs,w2-import-prs}.test.ts`; e2e `e2e/pr.spec.ts` | unit rc=0, `Test Files 13 passed (13) Tests 77 passed (77)`: prs 8, pr-tracker 14, use-pr-celebrated 3, finish-workout-pr-history 2, review-r01-pr-live-logs 8, db w2-import-prs 5, w2-prs-chains 4, w2-prs-f3-time 8, w2-prs-rebuild 8, w2-prs-rebuild-all 5, w2-prs-restore-stamp-perf 3, legacy-import-service-prs 5, import w2-import-prs 4; e2e `✓ beating the stored best e1RM celebrates the PR and persists it` (reads `prRecords` through the `listPRRecords` hook, 3fa944f), `✓ a heavier warm-up or undone set is not a PR: straight to history`, `✓ a first-ever exercise is a baseline: no celebration` |
| AC7 analytics correctness | **MET** | `npx vitest run analytics` | `Test Files 20 passed (20) Tests 169 passed (169)`. `src/lib/analytics/__tests__/ac7-correctness.test.ts` holds the hand-derived values (48 h window, ACWR/volume/impact over done working sets of live logs) |
| AC8 data integrity | **MET** (real figures below) | `npx vitest run data-integrity --reporter=verbose`; `npm run catalog:build -- --check`; `npm run check-bundle` | `Tests 16 passed (16)`, including `✓ every preset exercise id resolves in the catalog`, `✓ no TYTAX exercise has the generic station "Tytax"`, `✓ every station and attachment is a valid library.json id with a provenance`, `✓ AC8: exercises with an unresolved station are ≤ 5 % of 1,436 (28 ambiguous machine moves = 1.9 %)`, `✓ the catalog is lazy…`. Catalog: `source 1436, excluded 27, catalog 1409, unresolved 28 (1.9% of 1436), no station by design 53, without station 81 (5.6% of 1436)`. Bundle: `first-load JS for /dashboard: 238.7 kB gzip (budget 250 kB)`, `check-bundle: OK`, all 24 routes within 250 kB, `catalog leak: no` on every route |
| AC9 family profiles | **MET** (known flake, U21) | e2e `e2e/profiles.spec.ts`, `e2e/profiles-ui.spec.ts`, `e2e/fixtures-profiles.spec.ts` | chromium: `✓ two profiles see only their own history; switching swaps it`, `✓ deleting a profile wipes only its data and hands over to the other`, `✓ create, switch and delete profiles from settings; data stays isolated`. mobile: `✓ 36 [mobile] › e2e/profiles.spec.ts:114:5 › two profiles see only their own history; switching swaps it (9.1s)`, `✓ 37 [mobile] › e2e/profiles.spec.ts:128:5 › deleting a profile wipes only its data and hands over to the other (7.9s)`, `✓ 33 [mobile] › e2e/profiles-ui.spec.ts:11:5 › create, switch and delete profiles from settings; data stays isolated (13.4s)`, `✓ 4 [mobile] › e2e/fixtures-profiles.spec.ts:8:5 › tytax fixture switches and removes profiles through the app repository (5.0s)`. **Known flake:** `profiles.spec.ts:114`, the proving test for the isolation clause, failed once on mobile in 3 full dev runs during integration (`window.__tytaxE2E is missing` after a bare reload; test-harness timing, not a data leak; 0 failures in 20 isolated runs). Filed as U21 |
| AC10 legacy import | **MET** | `npx vitest run legacy-import` | `Test Files 16 passed (16) Tests 150 passed (150)`. Counts are asserted against `src/lib/import/__fixtures__/expected.ts` for the three fixtures |
| AC11 tools and navigation | **MET** | e2e `e2e/nav.spec.ts` (routes in `e2e/routes.ts`), `e2e/tools.spec.ts` | nav: 12 tests pass, including `✓ no navigation link is dead` and `✓ /tools/plate-calculator answers 200 and renders its heading`. tools: `✓ plate calculator: 100 kg on a 20 kg bar is 25 + 15 per side`, `✓ 1RM calculator: 100 kg × 5 estimates 112.5 kg`, `✓ rest timer starts at the profile default, takes +30 s and counts down`, `✓ swap: picking a suggestion replaces the exercise on the card` |
| AC12 sync, flag on, local Supabase | **MET** (the mandatory CI job `sync-e2e` passed on GitHub, runs 36294400362 / 36294397067) | `npm run test:sync`; `npx -y supabase@2.118.0 test db`; e2e `@sync` specs in the chromium run | test:sync rc=0: `Test Files 3 passed (3) Tests 20 passed (20)` (round trip, RLS, tombstones, LWW, retry cursor, idempotent re-push, request limit). test db rc=0: `Files=10, Tests=810 … Result: PASS` (including `01_signup_profile.test.sql` for the profile on signup). e2e chromium: `✓ a workout logged on device A reaches device B through Supabase @sync`, `✓ sync on, signed out: the app still works and nothing is sent @sync`; e2e mobile: `✓ 50 [mobile] › e2e/sync-roundtrip.spec.ts:64:5 › a workout logged on device A reaches device B through Supabase @sync (12.3s)`, `✓ 52 [mobile] › e2e/sync-roundtrip.spec.ts:111:5 › sync on, signed out: the app still works and nothing is sent @sync (6.0s)` |
| AC13 auth failure handling | **MET** | `npx vitest run auth`; `npx vitest run callback`; for the missing-env clause `npx vitest run src/lib/auth/__tests__/helpers.test.ts src/app/auth/callback/__tests__/route.test.ts src/app/auth/login/__tests__/login.test.tsx --reporter=verbose`; e2e `e2e/auth-callback.spec.ts` | `auth` `Test Files 6 passed (6) Tests 109 passed (109)`; `callback` `Tests 16 passed (16)`. Missing env shows an error, not a spinner (rc=0, `Test Files 3 passed (3) Tests 44 passed (44)`): `✓ src/lib/auth/__tests__/helpers.test.ts > signInWithMagicLink > returns auth_not_configured (no throw) when Supabase env is missing`, `✓ src/app/auth/callback/__tests__/route.test.ts > GET /auth/callback > missing env → auth_not_configured`, `✓ src/app/auth/login/__tests__/login.test.tsx > LoginPage > not configured: shows the error immediately, disables the form, keeps "continue without account"`; e2e `✓ provider error lands on login with the code only…`, `✓ callback without a code lands on login with a deterministic error`, `✓ a failed exchange with next=//evil.com lands on login on this origin`, `✓ next=//evil.com on a successful exchange lands on /dashboard on this origin @sync` |
| AC14 i18n and a11y | **MET** | `npx vitest run i18n`; `npm run lint` (`i18next/no-literal-string` = error on `src/**/*.tsx`); e2e `e2e/a11y.spec.ts` | i18n `Test Files 8 passed (8) Tests 56 passed (56)` (hr/en parity, packs); lint: no problems; a11y: `✓ /dashboard`, `/workout`, `/exercises`, `/history`, `/settings` `has no serious axe violations`, `✓ secondary G4 screens have no serious axe violations`, `✓ pinch zoom is allowed and the document language is set` (userScalable removed) |
| AC15 PWA | **MET** | `npm run test:e2e:offline` (prod build with E2E hooks, `E2E_SERVER=prod`); manifest check with `node -e` over `public/manifest.json` | rc=0, `5 passed (8.9s)`: `✓ a workout can be logged while offline`, `✓ an offline reload can use a catalog chunk never opened before`, `✓ an uncached route offline falls back to the offline page`, `✓ switching to English works offline…`, `✓ a backup can be restored while offline`. Manifest: `display "standalone"`, `start_url "/dashboard"`, icons `192x192` and `512x512` in both `any` and `maskable`, with every file present. It is linked from `src/app/layout.tsx:14`. No test drives a browser install prompt |
| AC16 CI | **MET** | `PORT=3110 bash scripts/ci-local.sh` (a local mirror of `.github/workflows/ci.yml`); `gitleaks git --redact`; `npm audit --audit-level=high` | rc=0, `CI-LOCAL: PASS`. Every step passes: quality (guard .only/.skip, npm ci, lint, tsc, test:coverage, build, check-bundle), e2e chromium+mobile (`124 passed`), e2e-offline (`5 passed`, `playwright: ran=5 skipped=0`), sync-e2e (supabase test db `Result: PASS`, `UPGRADE TEST: PASS`, test:sync `vitest: ran=20 skipped=0`, playwright sync+auth `ran=6 skipped=0`), and security (gitleaks, npm audit high). gitleaks: `210 commits scanned … no leaks found`. npm audit high: rc=0 (`5 vulnerabilities (1 low, 4 moderate)`). **PR checks green:** GitHub Actions on PR #45: run 36294400362 (pull_request) and 36294397067 (push) — all 5 jobs pass: quality, e2e (chromium + mobile), e2e-offline, sync-e2e (local Supabase), security. The first run failed every job at tsc on a docs/ script importing sibling-worktree paths (host-only); fixed in the tsconfig `exclude` commit and re-verified in a fresh clone before the re-run |
| AC17 baseline | **PARTIAL** (the rest is morning and owner work) | `grep -n "^#" README.md`; `sed -n 1,12p CHANGELOG.md`; `gh pr list -R bureksirovic-web/tytax-autonomous --state open`; `gh repo view … --json isArchived`; `gh issue list -R bureksirovic-web/new_tytax` | README has the stack, run, env, sync, privacy, deploy and rollback sections, **but** it still labels v2 features "in progress / not yet verified" (lines 8, 11, 20–26; filed as U28). CHANGELOG has `## [Unreleased]`. Issues: 0 open in new_tytax. They are listed in `docs/v2/ISSUES-TO-FILE.md` (28) and are the next step. tytax-autonomous: `isArchived: false` and 16 open PRs (#61–76); new_tytax: 0 open issues. Raw `gh` output is pasted below the table. The #67–76 mandate and the archive are **morning items** |
| AC18 migration and import safety | **MET** | `npx vitest run migration`; `npx vitest run legacy-import` (transactional import); e2e `workout-loop.spec.ts`, `offline.spec.ts` | migration `Test Files 13 passed (13) Tests 93 passed (93)` (v2→v3 into `SessionExercise[]`, idempotent re-run, malformed legacy shapes, rollback); legacy-import 150 passed (failed import leaves the DB unchanged, re-import idempotent); `✓ the same exercise added twice logs independently`; `✓ an offline reload can use a catalog chunk never opened before` |
| Zero skips (§10.2, all suites) | **MET** | `grep -rnE "\b(test\|it\|describe\|suite\|bench)(\.(describe\|serial\|parallel\|concurrent\|sequential))?\.(only\|skip\|fixme\|todo\|skipIf\|runIf\|fail\|fails)\b" src e2e`; runtime no-skips reporters | grep: no matches (`grep rc=1`). vitest shows no skipped count. The Playwright no-skips reporter reported only the 4 `offline.spec.ts` serial siblings of the by-design dev failure below. On the prod server all 5 ran and passed |

**AC17 raw `gh` output** (06:17, on `d3bb596`):

```
$ gh pr list -R bureksirovic-web/tytax-autonomous --state open --limit 50
76	⚡ Bolt: Memoize getImpact optimization	bolt-memoize-getimpact-1536020764741824072	OPEN	2026-02-05T23:08:41Z
75	⚡ Bolt: Memoize getImpact parsing	bolt-memoize-impact-18296593054922659561	OPEN	2026-02-04T23:18:10Z
74	⚡ Bolt: Memoize getImpact to optimize filtering and analytics	bolt-memoize-getimpact-13620585226430771141	OPEN	2026-02-03T23:27:36Z
73	⚡ Bolt: Optimize getImpact with WeakMap caching	bolt/optimize-get-impact-memoization-13870432028214641695	OPEN	2026-02-02T23:14:18Z
72	⚡ Bolt: Memoize Arsenal category generation	bolt-optimize-arsenal-categories-9932473860794374723	OPEN	2026-02-01T23:36:02Z
71	⚡ Bolt: Cache `getImpact` calculation	bolt-cache-getimpact-1213746196255912183	OPEN	2026-01-31T23:22:46Z
70	⚡ Bolt: Optimize workout view render loop	bolt-optimize-workout-render-877706977311523666	OPEN	2026-01-30T23:31:50Z
69	⚡ Bolt: Memoize getImpact for 19x faster parsing	bolt/memoize-getimpact-11920355442424871934	OPEN	2026-01-29T23:18:27Z
68	⚡ Bolt: Memoize getImpact for faster list filtering	bolt/memoize-get-impact-17402918018732187399	OPEN	2026-01-28T23:20:59Z
67	⚡ Bolt: Optimize getImpact with WeakMap memoization	bolt-optimize-get-impact-6140043359702273978	OPEN	2026-01-27T23:38:25Z
66	⚡ Bolt: Memoize getImpact for faster list filtering	bolt-memoize-impact-15757634462254178008	OPEN	2026-01-26T23:22:50Z
65	⚡ Bolt: Memoize getImpact for faster list filtering	bolt/memoize-get-impact-1501355913590789231	DRAFT	2026-01-25T23:18:08Z
64	⚡ Bolt: Memoize getImpact for faster filtering	bolt-memoize-impact-16194524769015875143	DRAFT	2026-01-24T23:25:04Z
63	⚡ Bolt: Memoize getImpact for faster rendering	bolt/memoize-get-impact-15578713207971785279	DRAFT	2026-01-23T23:35:18Z
62	⚡ Bolt: Memoize getImpact and Arsenal categories	bolt-memoize-impact-13836002172320153053	DRAFT	2026-01-22T23:30:08Z
61	⚡ Bolt: Memoize Live Session Impact	bolt/memoize-impact-calc-7710368578722547047	DRAFT	2026-01-21T23:33:43Z
$ gh pr list -R bureksirovic-web/tytax-autonomous --state open --limit 50 --json number,author,isDraft --jq '.[] | "\(.number) \(.author.login) draft=\(.isDraft)"'
76 bureksirovic-web draft=false
75 bureksirovic-web draft=false
74 bureksirovic-web draft=false
73 bureksirovic-web draft=false
72 bureksirovic-web draft=false
71 bureksirovic-web draft=false
70 bureksirovic-web draft=false
69 bureksirovic-web draft=false
68 bureksirovic-web draft=false
67 bureksirovic-web draft=false
66 bureksirovic-web draft=false
65 app/google-labs-jules draft=true
64 app/google-labs-jules draft=true
63 app/google-labs-jules draft=true
62 app/google-labs-jules draft=true
61 app/google-labs-jules draft=true
$ gh repo view bureksirovic-web/tytax-autonomous --json isArchived
{"isArchived":false}
$ gh issue list -R bureksirovic-web/new_tytax --state open
(no output, rc=0)
```

**The full e2e runs, stated plainly.** Both runs were on the dev server with the sync env, and neither is green on its own:
- `npx playwright test --project=chromium`: rc=1, `65 passed, 1 failed, 4 did not run`.
- `npx playwright test --project=mobile` (re-run on `d3bb596`, @sync specs included, as in every integration-log full run): rc=1, `65 passed, 1 failed, 4 did not run`. The first mobile run at 06:06 used `--grep-invert @sync` (`62 passed, 1 failed, 4 did not run`); that flag had no reason, so it was dropped and the run repeated.

In both, the one failure is `offline.spec.ts:53`, with `Error: offline.spec needs E2E_SERVER=prod (see docs/v2/requests/G4-03)`. This is by design under `next dev`. The CI e2e job excludes the file, and `npm run test:e2e:offline` runs it on a prod build (5/5 above). Because the plain local run can never be green, this is filed as U20.

AC8 note: 81 of 1,436 entries (5.6 %) have no station. 53 of them have none by design: 37 stretches and 16 free-standing bodyweight moves ("NONE", the Wave 2 coordinator's ruling). The other 28 are unresolved machine moves (1.9 %), which meets the ≤ 5 % clause as amended. The owner review of the 50-row sample (`docs/v2/station-sample.md`) is still open (U15).

## 3. Per goal: what it did, what it gave up on

Sources: `docs/v2/goals/G1..G5-REPORT.md` (Wave 1 and Wave 2 sections), `~/Projects/tytax-v2/signals/WAVE2.md`, and `docs/v2/integration-log.md`.

**G1: Wave 0 foundation, exercise data, training engine.** 22:08 → 23:50, then Wave 2 00:25 → ~01:15.
- **Did:**
  - Wave 0 in 45 minutes (`0cfb58e`, gate green):
    - frozen contracts;
    - a Dexie v3 repository;
    - a lazy catalog;
    - a persisted workout draft;
    - the e2e fixtures;
    - lint bans;
    - the CI skeleton.
  - A deterministic catalog build: 1,436 source entries, 1,409 exercises, stable ids, and `stationProvenance` on each exercise.
  - The original 6-day plan as the default preset, with every preset id resolving.
  - The training engine: e1RM, warm-ups, RIR prefill, ghost reps, PRs, recovery (48 h), ACWR with a cold start, and deload.
  - `check-bundle.mjs`.
  - Wave 2:
    - time-measured sets (92 tagged);
    - `rankableE1rm` (e1RM ranked only up to 12 reps);
    - FRAME and FREE_WEIGHT stations, which bring the unresolved count from 145 (10.1 %) down to 28 (1.9 %);
    - `orderByStation`;
    - program helpers;
    - video links;
    - npm audit highs cleared with `overrides`.
  - 2 DSH refuters: all 5 of R2's findings were reproduced and fixed; of R1's 3, 2 were fixed and R1-1 was documented.
- **Gave up on:**
  - T1-X app metadata as a station source: it sits behind a bot checkpoint.
  - The station mapping still needs an owner review (U15).

**G2: persistence, family profiles, migration, import and export.** 22:09 → 23:55, then Wave 2 00:21 → 02:25.
- **Did:**
  - The tytax-autonomous backup parser, with zod validation, size and depth caps, and a prototype-pollution guard.
  - A uuid-v5 mapper.
  - BackupV3 export and restore, with a conflict confirmation.
  - CSV with formula escaping.
  - A pure, deterministic v2→v3 migration that stores the pre-migration export.
  - An atomic, idempotent `finishWorkout`.
  - LWW `applyRemote`.
  - Wave 2:
    - `logs.update` recomputes PRs for later logs;
    - import writes PR records;
    - time sets;
    - machine setup notes;
    - pinned exercises;
    - device wipe;
    - hostile restore needs a confirmation.
  - Coverage on owned dirs: 97.6 % lines.
- **Gave up on:**
  - A 20 MiB restore benchmark (U23).
  - The negative `skipped` count. This was fixed at integration (dc7f8f1).

**G3: the workout loop.** 22:10 → 23:58, then Wave 2 before the 03:30 deadline (end time not recorded).
- **Did:**
  - Quick and program workouts.
  - A persisted draft that survives a reload, with duplicate exercises and reordering.
  - Deload offer, weak-point injector, kettlebell prefill.
  - Swap suggestions.
  - A timestamp-based rest timer and wake lock.
  - Debrief and PR celebration.
  - Tools: plate calculator, 1RM calculator, timer.
  - Foreign-profile draft handling and rest-day completion.
  - Wave 2:
    - time sets with a hold timer;
    - machine setup at workout time;
    - order by station;
    - `startFromLog` (repeat);
    - a 1RM warning above 12 reps;
    - a fix for clipping at 360 px.
  - 2 DSH refuters: 20 findings, 18 fixed.
- **Gave up on:**
  - Repeat with no catalog loaded (U11).
  - The kg field has 0 px spare at 360 px (U18).
  - Mobile Playwright was not run by G3. It was run at integration.

**G4: every other screen, i18n, a11y, PWA.** 22:10 → 00:15, then Wave 2 00:20 → ~01:55.
- **Did:**
  - The hr-default i18n dictionary with 282 folded request keys.
  - A focus-trapped dialog, skip link and semantic tokens.
  - The PWA: icons, hr manifest, service worker precache, catalog warm-up.
  - Screens: dashboard, programs (install, builder, slot editor), exercises (filters, favourites, detail), history (list, detail, editor, undo), analytics, and settings (profiles, language and units, training defaults, equipment, backup/restore/CSV, legacy import).
  - Wave 2:
    - restore confirmation;
    - the test ids G3 asked for;
    - foreign draft;
    - F8 lookup;
    - `/settings` under 250 kB;
    - machine setup editor;
    - Repeat workout;
    - pinned exercises;
    - station filter;
    - axe on 6 more screens.
  - 2 DSH refuters: 18 findings; 1 S1 was not reproduced after the G1 merge.
- **Gave up on or did not build:**
  - The ONLINE/STANDBY pill, streak/level tiles, program-load heatmap and mobile filter sheet (U27).
  - A "Done N×" badge and most-used sort (U25).
  - Localised `<title>` (U16).
  - Recovery thresholds are an open owner question (U14).

**G5: sync, auth, backend, CI, docs, then INTEGRATION.** 22:09 → now.
- **Did (pre-integration):**
  - Migrations 002–004: signup profile trigger, `updated_at`/`deleted_at`, RLS `using` + `with check`, composite FKs, quotas.
  - pgTAP tests and an upgrade test.
  - One sync path (supabase-js with RLS): the old `/api/sync`, `/api/profile` and `/api/workout` and the old engine were deleted.
  - Mapper, cursors, tombstones and server LWW.
  - Auth callback error handling and a `next` allow-list.
  - `proxy.ts` session refresh.
  - The CI workflow with 5 jobs, and `scripts/ci-local.sh`.
  - README and CHANGELOG.
- **Did (integration):**
  - 7 merges.
  - 61 request files triaged (`docs/v2/requests/INDEX.md`).
  - Coverage thresholds, and `no-literal-string` raised to error.
  - The first-load budget on every route: the i18n dictionary was split per locale and screen (−27 to −33 kB on every route).
  - 14 refuter fixes.
  - 4 critic rounds and a Terra pass, which added migration 005 (request guard), push chunking, backlog fixes and the invalid-row hold.
- **Gave up on:**
  - Stray-default-profile cleanup (U6).
  - Decimal RPE (U7).
  - The gateway body cap (U2, outside the repo).
  - Proving AC16 on GitHub (not pushed).

## 4. Review

**Local refuters.** Engine queue checked first each time.
- **Per goal:**
  - G1: 2 DSH refuters. R2: 5 of 5 findings reproduced and fixed. R1: 3 reproduced, 2 fixed, and R1-1 documented, not changed (G1-REPORT "Hardening").
  - G2: 11 findings in the workflow (10 fixed, 1 not reproduced), plus 26 failing DSH cases (20 fixed, 4 dropped as design with measurement, 2 unfixed; 1 of those was later fixed at integration).
  - G3: 20 findings (18 fixed, 1 routed to G4 and fixed at integration, 1 dropped: its symbol does not exist).
  - G4: 18 findings (13 fixed by G4; 2 not reproduced, 1 of them hardened anyway; 3 were other goals' items, already requests, and all 3 are fixed in the merged tree).
- **At integration** (2 refuters against the merged diff, `docs/v2/integration-log.md` §12): **14 reproduced, 14 fixed**, each red-before/green-after, and 0 dropped.
- **Partial, with residuals:**
  - #1: dead letters are not surfaced (U5).
  - #8: `startFromProgram` is dead code (U12).
  - #13: the time-set measure is unknown without the catalog (U11).

**Critic gate** (`critic-gate --job tytax-v2`, critic Terra, author Opus, cross-family; `docs/v2/critic-verdict.md`):
- **Rounds:**
  - r1: 2/10.
  - r2: **3/10, best**.
  - r3: 2/10.
  - r4: 2/10.
  - r5: refused as stalled (exit 11).
- **Delivered with `--best`: round 2, REJECTED 3/10.**
- **Stated reason for the remaining rejection:** there is no request-body limit at the Kong/API gateway, locally or hosted. It is **not settable from this repo**:
  - the CLI's Kong has `client_max_body_size 0`;
  - `supabase/config.toml` has no key for it;
  - the hosted gateway is a platform setting, and cloud Supabase was out of bounds.
  - The in-repo bound is migration 005: `request_guard()` refuses bodies over 4 MiB before PostgreSQL parses them.
- **Owner rule (2026-09-12):** the score is recorded, not a veto. Refuter and cloud-lane findings outrank it, and every real one is fixed.
- **Fixed in response to the critic:**
  - r1 D2 (repair archive, 4b7a03f);
  - r2 D1 in-repo part (005, e85356e);
  - r3/r4 D2 (unmappable row holds the cursor and the run ends `invalid_row`, cab4591, d5628ba).
  - r1 D1 was shown to be not reproducible and is pinned by `sw-cache-user-independent.test.ts`.
- **Residuals:** U2 (gateway cap) and U4 (null `family_member_id` rows).

**Terra pass** (`lane terra --effort high`):

| # | Sev | Finding | Disposition |
|---|---|---|---|
| T1 | S1 | Service-worker navigation cache replays one account's HTML to another | False: all shell routes are static prerenders; pinned by a 14-test invariant (7bb8475) |
| T2 | S1 | `pg_column_size(n.*)` misses TOASTed values, so the quota can be bypassed | False, measured: 1,260,020 TOASTed bytes charged as 1,260,705 |
| T3 | S2 | 6,400 dead or other-account ops hide every live op | Fixed (715e7d8) |
| T4 | S2 | Backlog over 50×200 ops ends idle with no follow-up | Fixed (715e7d8) |

No Terra residuals.

## 5. Environment actions on this host

These are from `docs/v2/goals/G5-REPORT.md` "Environment actions", re-checked at 06:10. Host-specific names (user, network interfaces, process ids) are left out because `bureksirovic-web/new_tytax` is a public repository.
- **Docker daemon:** started for this boot, not enabled. `systemctl is-enabled docker` gives `disabled`, and `is-active` gives `active`.
- **Socket ACL:** a `setfacl` rw entry on `/var/run/docker.sock` for the invoking user, for this boot only. It is lost on reboot or when the socket is re-created.
- **iptables:** `DOCKER-USER` DROP rules for ports 54420:54431 on the dev host's external interfaces, for this boot only (U1).
- **Local Supabase:** the stack (`project_id tytax-v2`) was left up for the morning steps; §8 has the clean-up.
- **Port 3100** is held by an unrelated local service, which was not touched. Every integration Playwright run used `PORT=3110` and `NEXT_PUBLIC_APP_URL=http://localhost:3110`.

## 6. Estimate vs actuals

| | Estimate (PLAN §8, §10.6) | Actual |
|---|---|---|
| Wall clock | Wave 0 2–3 h; goals 6–8 h in parallel; morning integration 2–3 h | Wave 0 45 min (22:08 → 22:52). Goals: Wave 1 finished 23:50–00:15, Wave 2 finished 01:15–03:30. G5 ran continuously from 22:09 to about 06:15 (integration was done overnight, not in the morning), about 8 h in total |
| Paid tokens per lane | 1b Astra + Fable ~1 call each; 5 ultracode goals (the dominant drain); Terra critic; no Sol | **See the lane-tokens ledger.** The goal reports quote Claude subagent totals from their own workflows: G1 ~5.4 M + 0.41 M, G2 ~3.5 M + ~1.1 M, G3 ~2.4 M, G4 not totalled. Critic: 4 Terra rounds plus 1 Terra pass; no Sol call |
| Local (DSH/Qwen) agent-hours | ~6–10 h | Rough, about 5–8 h. G1 ~1 h (2 refuters in parallel, ~30 min each, plus a 56 s classification call). G2 ~2.5 h (2 agents × ~1 h 15 min). G3, G4 and the integration refuters used 2 each, but their duration is not recorded |

## 7. Unfixed findings

This list covers every unfixed or partial item from the sources:
- the G1 to G5 reports;
- the integration-log "Unfixed" and "Deferred" entries;
- the refuter partials;
- the critic and Terra residuals;
- declined requests that carry debt;
- open `WAVE0_REVIEW` items (there are none).

Duplicates are merged: for example, G3's "repeat without catalog" and refuter #13's residual are one item (U11), and G5's dead letters and refuter #1's partial are one item (U5).

**28 items: 1 S2 security, 2 S3 security, 25 S3 debt.** Nothing is S1. The same 28 items are in `docs/v2/ISSUES-TO-FILE.md`, and the issue bodies are ready to file.

#### U1. Local Supabase dev stack publishes ports 54420-54431 on every host interface (S2, security)
- **What:** `supabase start` (CLI 2.118.0) binds the local stack (Postgres with the default local password, Kong, Studio, Mailpit) to 0.0.0.0:54420-54431, so any network the dev host is on (LAN, WireGuard, Tailscale) can reach it while it runs.
- **Evidence:** `docker ps --format '{{.Ports}}'` shows 0.0.0.0 bindings (docs/v2/goals/G5-REPORT.md, Unfixed findings and Environment actions). The only mitigation is non-persistent iptables DOCKER-USER DROP rules for 54420:54431 on the external interfaces, added for this boot only.
- **Why not fixed:** `supabase/config.toml` has no bind-address option; a persistent host firewall rule is a host change outside this repo and was not in the overnight mandate.
- **Proposed fix:** Add a persistent DOCKER-USER drop rule (nftables/ufw) for 54420:54431 on external interfaces on every dev host that runs the stack, and document it in README 'Sync' next to `supabase start`; or run the stack only on a host without external interfaces.

#### U2. No request-body size cap at the Supabase API gateway (Kong/PostgREST) (S3, security)
- **What:** Write bodies reach Kong and PostgREST before `public.request_guard()` (migration 005, 4 MiB, db-pre-request) refuses them; the gateway itself accepts any size.
- **Evidence:** Critic-gate job tytax-v2 rounds 2-4, defect D1 (docs/v2/critic-verdict.md 'Not fixed' #1). Local gateway `public.ecr.aws/supabase/kong:2.8.1` has `client_max_body_size 0` in `/usr/local/kong/nginx-kong.conf`; `supabase/config.toml` (CLI 2.118.0) has no key for it. `supabase/README.md` records the residual.
- **Why not fixed:** The limit is a Supabase platform setting outside the repo, and cloud Supabase was out of bounds for the overnight run.
- **Proposed fix:** When sync goes live on hosted Supabase: ask Supabase support for a gateway body cap (4 MiB matches `request_body_limit()` and the client's `MAX_PUSH_BYTES` 2 MiB split) or front the API with a reverse proxy that enforces it; record the setting on the wiki project page.

#### U3. npm audit: 1 low and 4 moderate dev-only advisories remain (S3, security)
- **What:** `npm audit` reports 5 vulnerabilities (1 low, 4 moderate), all in dev dependencies (the @vitest/mocker GHSA-82fw-gwwq-j7x9 chain). The CI gate is `--audit-level=high`, which passes.
- **Evidence:** `npm ci` notice on v2 HEAD: `5 vulnerabilities (1 low, 4 moderate)`; integration-log §10 step 4; G1-REPORT W2-F4.
- **Why not fixed:** Below the CI threshold; the high advisories were cleared with `overrides` (G1 F5, 3493ecc). Upgrading vitest mid-integration was out of scope.
- **Proposed fix:** Bump vitest/@vitest/* when a patched release is available (or add a version-scoped override), then run the gate and `npm audit`.

#### U4. Server rows with a null family_member_id stay unpullable (sync shows invalid_row) (S3, debt)
- **What:** Legacy server rows whose `family_member_id` migration 002 repaired to null cannot be mapped by the client. They no longer get lost (they hold their table's pull cursor and the run ends `error`/`invalid_row`), but they never land until the server assigns a family member.
- **Evidence:** Critic rounds 3-4 defect D2 residual (docs/v2/critic-verdict.md 'Not fixed' #2); fixes cab4591, d5628ba; `src/lib/sync/__tests__/pull-invalid.test.ts`.
- **Why not fixed:** Needs a server data-repair migration that also changes the 002 upgrade-test expectation `cross-account workout_logs.family_member_id repaired to null`; too large for the last critic round.
- **Proposed fix:** Migration 006: create one recovery family member per affected account, point the null rows at it, archive the old values in `public.migration_repair_archive` like 002; extend `supabase/upgrade_test`.

#### U5. Permanently rejected sync ops stay pending forever with no user action (S3, debt)
- **What:** An op that fails with `permanent:<code>` stays in the outbox, counts in `pending`, and is only acked when a newer op for the same record succeeds. The user cannot see or resolve it; a later pull may overwrite the rejected local edit by design.
- **Evidence:** G5-REPORT 'Permanently failed ops'; docs/v2/sync-schema.md 'Dead letters'; integration refuter #1 partial (docs/v2/integration-log.md §12: dead-lettered keys are intentionally not kept in `pendingRecordKeys`, `outbox-ops.ts`).
- **Why not fixed:** Silently dropping would lose data; pinning a rejected row against every newer server copy is also wrong. Needs a small UI decision.
- **Proposed fix:** Show a dead-letter count in the sync panel with 'keep mine / take server / discard' actions, plus an age-based ack; test with the fake remote.

#### U6. New device: an empty default profile is claimed by the account and pushed to every device (S3, debt)
- **What:** `AppBootstrap` calls `repo.profiles.ensureActive(DEFAULT_PROFILE_NAME)` before the first sign-in and pull. On a fresh device that then signs in, the account's pulled profiles arrive next to an empty default profile; the claim (`src/lib/sync/adapter.ts`) gives that profile the account and pushes it.
- **Evidence:** `src/components/providers/app-bootstrap.tsx` (ensureActive before first sync); G5-REPORT 'Stray default profile on a new device'. No dedicated test yet.
- **Why not fixed:** Needs a product decision (merge into, or drop, an untouched default) touching the profile repo; out of time overnight.
- **Proposed fix:** On the first run for an account, if the local default profile has no records and the server has profiles, delete it before the claim; pin with an adapter test.

#### U7. workout_logs.rpe is an int column while the contract and importers accept decimals (S3, debt)
- **What:** `workout_logs.rpe` is `int` (`supabase/migrations/001_initial_schema.sql:121`), but `rpe?: number` in `src/contracts/domain.ts` and the legacy/backup importers (`src/lib/import/schema.ts:31` `numLike`) allow values like 7.5. The debrief UI rounds to integers, so only imported/restored data can carry a decimal; pushing such a row would be rejected (22P02) or rounded.
- **Evidence:** Schema and contract lines above; G5-REPORT 'Decimal RPE goes into an int column'. Not reproduced end to end.
- **Why not fixed:** Found late; needs a migration plus a pgTAP case.
- **Proposed fix:** Either migration: `alter table workout_logs alter column rpe type numeric(3,1)` with a 1-10 check, or round RPE in the importers and the contract docs; add a sync test with 7.5.

#### U8. applyRemote still compares server and device clocks (server-wins lives only in pull.ts) (S3, debt)
- **What:** `repo.applyRemote` keeps G2's documented LWW (`remote.updatedAt <= local.updatedAt` skips). The sync path gets the correct semantics (skip records with a queued op, otherwise server wins) from a pending check in `src/lib/sync/pull.ts`, at the cost of one `exportBackup()` per sync run that pulls rows.
- **Evidence:** Requests G5-01/G5-04 declined at repo level (docs/v2/requests/INDEX.md); `adapter-conflicts.test.ts`, live `conflicts.sync.test.ts` prove the pull-side behaviour; 3 G2 tests pin the repo LWW contract.
- **Why not fixed:** Moving it into applyRemote contradicts 3 pinned G2 tests and changes no behaviour for the only caller.
- **Proposed fix:** Add `applyRemote(table, rows, { serverWins: true })` for the sync path, keep G2's LWW tests for the default, then drop the `exportBackup()` pending scan in pull.ts.

#### U9. Login form ignores an email typed before hydration (submit stays disabled) (S3, debt)
- **What:** `#auth-email` is autofocused; text typed before React hydrates is visible but React state stays '', so the submit button stays disabled; retyping the same text does not help.
- **Evidence:** Two e2e failures during the G5 merge (docs/v2/integration-log.md §7, trace: hydrated page, `[disabled]` button with the email shown); `src/app/auth/login/login-form.tsx:62-68` (controlled input, `disabled={... || !email.trim()}`). The spec helper `fillLoginEmail` works around it; the product is unchanged.
- **Why not fixed:** Product fix not in the integration step's scope; only the test helper was hardened.
- **Proposed fix:** Read the DOM value on mount via a ref (or use `FormData` on submit) and enable the button from it; add a unit test that sets the input value before hydration.

#### U10. EquipmentInventory.configuredAt is not supported (no 'not configured' marker that survives sync) (S3, debt)
- **What:** Request G2-W2-03 (`configuredAt?`) was declined: equipment 'not configured' is inferred from the list rule plus `bodyweightGear: ['none']`.
- **Evidence:** docs/v2/requests/INDEX.md (G2-W2-03, G4-36 declined part); `src/lib/sync/columns.ts` whitelists columns, so a pulled row would drop the field.
- **Why not fixed:** Needs a Supabase column + migration, a mapper entry and the backup schema.
- **Proposed fix:** Migration: `equipment.configured_at timestamptz`; add to `columns.ts`, the BackupV3 schema and the contract; set it on first save in Settings.

#### U11. A time-measured exercise can be logged as reps when the catalog was never loaded (S3, debt)
- **What:** `measureOfExercise` needs the catalog or the device measure cache. On a device that has never loaded the catalog and whose first load fails, or on 'Repeat workout' with no catalog loaded, an old hold is treated as reps.
- **Evidence:** Integration refuter #13 residual (docs/v2/integration-log.md §12, fix dbe4806 added retry + `src/stores/measure-cache.ts`); G3-REPORT Wave 2 unfixed 'Repeat with no draft has no catalog loaded' (`src/hooks/use-workout.ts:227` `repeatLog` is synchronous).
- **Why not fixed:** The complete fix needs an optional contract field that `parseBackupV3` and the sync mapper must accept first.
- **Proposed fix:** Persist `measure` on `SessionExercise` at draft creation (optional contract field, accepted by backup schema and sync mapper); make `repeatLog` await `catalog.loadCatalog()`.

#### U12. Dead store API: workout-store.startFromProgram is no longer called by any screen (S3, debt)
- **What:** After the dashboard start-parity fix, both /workout and the dashboard start program sessions through the orchestrator; `startFromProgram` in the store remains with its own tests but no caller.
- **Evidence:** Integration refuter #8 partial (docs/v2/integration-log.md §12, fix 41f9ad4); `src/stores/workout-store.ts:104,252`.
- **Why not fixed:** Out of scope for the refuter fix; removing store API needs its tests reworked.
- **Proposed fix:** Remove it, or make it delegate to `buildSessionExercise` so a future caller cannot build a different draft.

#### U13. e1rm() grows steeply at 30-36 reps (1RM tool shows e.g. 3600 kg for 100 x 36) (S3, debt)
- **What:** The contract formula is Brzycki up to 36 reps and Epley from 37. PRs and analytics rank e1RM only up to 12 reps (`rankableE1rm`, `E1RM_MAX_REPS`), but the 1RM tool and live e1RM still show the raw value, with a warning above 12 reps.
- **Evidence:** `training.e1rm(100,36)=3600` (G3-REPORT unfixed); G4-41; integration-log §5 'contract owner decision'. The tool warning is covered by `e2e/tools.spec.ts` '1RM calculator warns above 12 reps'.
- **Why not fixed:** Contract behaviour; changing it is an owner decision.
- **Proposed fix:** Owner picks: cap reps in `e1rm()` (e.g. hide the estimate above 12-15 reps) or switch to a continuous formula; update the training contract tests.

#### U14. Recovery thresholds show a regular trainee as 'fried' for about 31 h after a session (S3, debt)
- **What:** The old app's recovery thresholds were kept; with them a regular trainee sees 'fried' for about 31 h after a session.
- **Evidence:** G4-REPORT 'Given up on' and `docs/v2/goals/G4-spec-dashboard-analytics.md` (owner question).
- **Why not fixed:** Product decision, not a defect in the port.
- **Proposed fix:** Owner decides the thresholds; adjust `src/lib/training` recovery constants with hand-derived fixture tests.

#### U15. Station mapping needs an owner review (sample of 50, 64 FRAME/FREE_WEIGHT remaps, 28 unresolved) (S3, debt)
- **What:** Stations were assigned by t1x metadata (284), 21+ name rules (1,021) and 23 manual picks. Assumptions ('sled' = Smith carriage, lever-arm pulleys, ski/poling on upper pulleys) and the 64 new FRAME/FREE_WEIGHT mappings need a TYTAX owner's check. 28 ambiguous machine moves (1.9 % of 1,436) remain unresolved; 81 (5.6 %) have no station, 53 of them by design.
- **Evidence:** `docs/v2/station-sample.md` (seed-42 sample), `docs/v2/station-unresolved.md`, G1-REPORT F6 / W2-F3; `npm run catalog:build -- --check`.
- **Why not fixed:** Needs domain knowledge of the TYTAX T1; app.tytax.com metadata is behind a bot checkpoint.
- **Proposed fix:** Owner marks the 50-row sample; corrections go into `scripts/data/station-manual.json`, then `npm run catalog:build` and the data-integrity test.

#### U16. Page <title> metadata is always Croatian (S3, debt)
- **What:** Server `metadata` in the page files uses the default locale (hr); an English-locale user sees Croatian tab titles.
- **Evidence:** `src/app/(app)/history/page.tsx:5` comment ('Server metadata uses the default language (hr)'); G4-REPORT unfixed 'Page <title> metadata'.
- **Why not fixed:** The server cannot see the client locale without a cookie read in the proxy; not integration work.
- **Proposed fix:** Set a `locale` cookie in LocaleProvider and read it in `generateMetadata` (the pages are prerendered static today, so check the cache impact first), or update `document.title` on the client.

#### U17. Hold durations use two formats: History mm:ss vs workout m:ss (S3, debt)
- **What:** History shows a 45 s hold as '00:45'; the workout screens show '0:45'.
- **Evidence:** docs/v2/integration-log.md §8 (G3-W2-03 row) and 'Deferred / Unfixed (step 2)'.
- **Why not fixed:** Cosmetic; both are unambiguous and each is pinned by tests.
- **Proposed fix:** Pick one formatter in `src/lib/utils` and use it on both screens; update the two test sets.

#### U18. Set-row kg input has 0 px spare at 360 px width (S3, debt)
- **What:** At 360 px the kg field fits '102.5' exactly (scrollWidth 62 = clientWidth 62); a 6-character value or a fallback font could clip.
- **Evidence:** G3-REPORT Wave 2 unfixed; `e2e/workout-wave2.spec.ts` '360 px phone' tests.
- **Why not fixed:** Within spec at the time; needs a visual pass.
- **Proposed fix:** Use `text-[15px]` on phones or widen the kg column; extend the 360 px spec with a 6-character value.

#### U19. First-load JS headroom on /workout/active is 3.3 kB (budget 250 kB gzip) (S3, debt)
- **What:** Every route is under the 250 kB budget (`check-bundle --budget-all-routes`), but `/workout/active` is at 246.7 kB, so a small addition will fail CI.
- **Evidence:** `npm run check-bundle` on v2 HEAD: `route /workout/active: 246.7 kB gzip`; integration-log §11 levers.
- **Why not fixed:** Budget met; further cuts were not needed to pass.
- **Proposed fix:** Drop the `AUTH_STRINGS` fallback in `src/lib/auth/i18n.ts` (~1.2 kB gz on every route, all keys are in the dictionary) and `next/dynamic` the closed workout sheets (picker, swap, setup).

#### U20. Plain `playwright test` always exits 1 locally: offline.spec fails by design under next dev (S3, debt)
- **What:** `offline.spec.ts:53` asserts `E2E_SERVER=prod` and fails under the dev server; its 4 serial siblings then do not run and the no-skips reporter flags them. CI excludes the file from the dev e2e job and runs it in `e2e-offline`, but a local `npx playwright test --project=chromium` is never green.
- **Evidence:** Fresh run on v2 HEAD (docs/v2/FINAL-REPORT.md AC table): `1 failed, 4 did not run, 65 passed`, failure `Error: offline.spec needs E2E_SERVER=prod`.
- **Why not fixed:** By design since G4-03; changing the config was not needed for CI.
- **Proposed fix:** In `playwright.config.ts` add `testIgnore: process.env.E2E_SERVER === 'prod' ? [] : ['**/offline.spec.ts']` (or a project split), so the full local run and `npm run test:e2e:offline` are both green.

#### U21. e2e flake: profiles.spec.ts calls tytax.snapshot() right after page.reload() (S3, debt)
- **What:** `tytax.snapshot()` runs before `window.__tytaxE2E` is reinstalled after a bare reload; 1 failure in 3 full dev runs ('window.__tytaxE2E is missing').
- **Evidence:** docs/v2/integration-log.md §11 'Unfixed (step 5)'; `e2e/profiles.spec.ts:114-125`. The flaky test is the AC9 proving test for profile isolation (docs/v2/FINAL-REPORT.md §2, AC9).
- **Why not fixed:** Not reproducible on demand (0 failures in 20 isolated runs).
- **Proposed fix:** Make `snapshot()` and the other hook calls wait for the hooks like `waitReady` does, or call `waitReady` after every reload in the spec.

#### U22. Timing-sensitive component tests (settings restore/import) under load (S3, debt)
- **What:** `legacy-import.integration.test.tsx` and `restore-confirm.test.tsx` timed out on `toBeEnabled` in partial vitest runs under load; `data-card.test.tsx` 'shows the not-yet-available controls disabled' asserts a state that is true only until the async API load finishes.
- **Evidence:** docs/v2/integration-log.md §11 and §12 (observed twice, passed on rerun and in every full `npm test`); §6 and §8 (G4-35 step 4 deferred).
- **Why not fixed:** Not reproducible on demand; nothing was deleted without a failure.
- **Proposed fix:** Await the async API load explicitly in these tests (findBy / waitFor on a loaded marker) instead of default timeouts; correct the data-card assertion with a comment.

#### U23. No timing benchmark for a 20 MiB backup restore (S3, debt)
- **What:** Large restores are tested for correctness up to 1000 rows but not for time; a refuter measured a 20 MiB BackupV3 parse at ~600 ms and ~4 s to the write phase.
- **Evidence:** G2-REPORT Wave 1 unfixed #3.
- **Why not fixed:** A timing test on a shared machine would be flaky inside `npm test`.
- **Proposed fix:** A benchmark script outside `npm test` (e.g. `scripts/bench-restore.ts`) with a recorded baseline.

#### U24. Programs: no hard delete for drafts, presets have no description (S3, debt)
- **What:** Request G4-17 (repo `programs.remove` hard delete + preset descriptions) was declined at integration; drafts are soft-deleted.
- **Evidence:** docs/v2/requests/INDEX.md (G4-17 declined), docs/v2/requests/G4-17-programs-hard-remove-and-preset-description.md.
- **Why not fixed:** New repo method + contract + product copy; not integration work.
- **Proposed fix:** Add `programs.remove` to the repo contract (tombstone for sync), preset `description` keys in hr/en, and the UI in the programs manager.

#### U25. Per-exercise usage counts ('Done N x' badge, most-used sort) not built (S3, debt)
- **What:** Request G4-21 was declined at integration; the exercises library has no usage badge or most-used sort (the old app had them).
- **Evidence:** docs/v2/requests/INDEX.md (G4-21 declined); G4-REPORT 'Given up on'.
- **Why not fixed:** Feature (new repo method + badge + sort), not integration.
- **Proposed fix:** Add a repo query counting done working sets per exercise for the active profile, a badge and a sort option; unit + e2e test.

#### U26. First-run onboarding wizard not built (S3, debt)
- **What:** Request G4-37 section 3 (onboarding: language, units, equipment, program on first run) was declined at integration.
- **Evidence:** docs/v2/requests/INDEX.md (G4-37 §3 declined), docs/v2/requests/G4-37-profile-prefs-on-boot-and-i18n-cleanup.md.
- **Why not fixed:** Product feature, not integration.
- **Proposed fix:** Owner confirms the steps; build a 3-4 step wizard shown when the active profile has no settings saved.

#### U27. Old-app dashboard extras and mobile filter sheet not ported (S3, debt)
- **What:** Not built: the ONLINE/STANDBY pill, streak and level tiles, the program-load heatmap on the dashboard, and a mobile filter bottom sheet on Exercises.
- **Evidence:** G4-REPORT 'Given up on / not built'.
- **Why not fixed:** Outside the G4 goal list; the daily loop does not depend on them.
- **Proposed fix:** Owner picks which ones still matter; build them as separate small PRs with axe + e2e coverage.

#### U28. README still says 'v2 (in progress)' and 'not yet verified' for shipped features (S3, debt)
- **What:** README status banner and feature table mark every v2 feature as in progress/unverified, and the CI section describes jobs as planned, although the v2 branch implements and tests them.
- **Evidence:** `grep -n 'in progress' README.md`: lines 8, 11, 20-26 (and the CI/Data sections).
- **Why not fixed:** The overnight integration step was docs for the reports only; the README rewrite belongs with the v2 PR.
- **Proposed fix:** Before merging the v2 PR: rewrite the status banner and feature table to the verified state (point at docs/v2/FINAL-REPORT.md), and describe the CI jobs as they are.

### Checked and not filed (closed, or no debt)
- **`signals/WAVE0_REVIEW.md`:** all 36 items are closed (R00–R21 and S3-00 to S3-13). `docs/v2/requests/INDEX.md` has a row for each, with its commit or test. The last two were S3-06, the cursor tiebreaker (the `(updated_at, id)` keyset), and S3-10, the dirty-tree SHA guard (61482c7).
- **Declined requests with no debt:**
  - G2 Wave 2 #2 (a back-dated finish re-derives later PR badges): working as designed.
  - G4-W2-45 (fixed on G4's side).
  - G4-W2-30 (a): optional.
- **Declined requests that carry debt** are filed: G4-17 (U24), G4-21 (U25), G4-37 §3 (U26), G2-W2-03 (U10), and G5-01/G5-04 (U8).
- **Goal-report items closed at or before integration:**
  - G1 F1/F4/F5/F7/F8, F2 (time sets), F3 (stored e1RM: `storedE1rm` now returns `rankableE1rm`, `src/lib/db/repo/rows.ts:129-131`) and W2-F1;
  - G2 Wave 1 #1 and #2, Wave 2 #1;
  - G3 AC4 through the UI, `prRecords` end-to-end, `crypto.randomUUID`, History time sets;
  - G4 hydration mismatch, PR count stale after an edit, legacy import disabled, pinned metrics device-local, the G3/G5 test breakage, the `/workout` test id;
  - G5 CSP `connect-src`, the service worker caching Supabase, backup `accountId`, AccountSection with sync off, S3-06, S3-10, lint residuals, and check-bundle and audit in the worktree.
  - Each one has its row in `docs/v2/requests/INDEX.md` or its step in `docs/v2/integration-log.md`.
- **The `slice.spec.ts` load flake from G4 Wave 2:** it did not recur in any integration run. The integration e2e runs were not all clean otherwise: the other non-offline failures were the `[mobile] profiles.spec.ts:114` flake on 4178790 (integration-log §11, filed as U21) and the `sync-roundtrip.spec.ts:63` and `auth-callback.spec.ts:86` disabled-submit failures after the G5 merge, fixed in 5fab111 and 1033f9b (integration-log §7; the product side is U9). Every other failure in those runs was the by-design `offline.spec.ts:53` failure under `next dev` (U20).
- **Terra T1/T2:** false, measured (§4).

## 8. Morning checklist (owner lanes)

- [ ] **D2 deploy decision:** Render (`render.yaml`) or rig/VPS. Nothing is deployed and no tag exists. After the decision, the release protocol runs: tag, push the tag, and `gh release create` in the same step as the deploy.
- [x] **Push `v2` and open the PR `v2 → main`**: done, PR #45 (not merged). CI green after one fix (see AC16). Absolute home-directory paths remain in 7 older docs under `docs/v2/` (low sensitivity; left as written).
- [x] **File the 28 issues** in `docs/v2/ISSUES-TO-FILE.md` in `bureksirovic-web/new_tytax`, then tick each box with its number. This completes the AC17 issues part. — DONE: filed #17–#44.
  - First create the labels. `gh label list -R bureksirovic-web/new_tytax` at 06:17 shows only GitHub's defaults (bug, documentation, duplicate, enhancement, good first issue, help wanted, invalid, question, wontfix), so `gh issue create --label security|debt|S2|S3` fails until they exist. The commands are in `docs/v2/ISSUES-TO-FILE.md`.
  - The repo is public. Decide before filing whether U1 (S2 security, local dev-stack exposure) is filed there as written (it names no host details) or kept private.
- [ ] **Archive `bureksirovic-web/tytax-autonomous`** with a pointer to new_tytax (`isArchived: false` today).
  - Close PRs #67–76 with "superseded by new_tytax v2" (the AC17 mandate).
  - Also close the bot PRs outside the mandate: **#61–65**, drafts by `app/google-labs-jules` (live listing at 06:17, pasted in §2).
  - **The owner decides on #66.** It is open, not a draft, and authored by the owner account like #67–76, but it is outside the #67–76 mandate (GOALS.md step 8, PLAN.md).
  - Archiving needs the owner's go.
- [ ] **If sync goes live on hosted Supabase:** set the gateway request-body limit (4 MiB, matching `request_body_limit()`) through Supabase support or a reverse proxy, and record it on the wiki page (U2). Also apply migrations 001–005 there, following the `supabase/README.md` preflight.
- [ ] **Review `docs/v2/station-sample.md`** (50 rows, seed 42) and the 64 FRAME/FREE_WEIGHT mappings in `docs/v2/station-unresolved.md`. Corrections go into `scripts/data/station-manual.json` (U15).
- [ ] **Owner decisions, filed as issues:**
  - the e1RM formula at high reps (U13);
  - recovery thresholds (U14);
  - the onboarding wizard and old-app extras (U26, U27).
- [ ] **Host clean-up when integration is closed:**
  - `npx -y supabase@2.118.0 stop` in `app/`;
  - optionally `systemctl stop docker`;
  - the socket ACL and iptables rules disappear on reboot;
  - persist a DOCKER-USER rule if the stack will run again (U1).
- [ ] **Before the PR merges:** rewrite the README status banner and feature table (U28).
