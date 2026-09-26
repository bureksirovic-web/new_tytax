# G4 report: every other screen, i18n, a11y and PWA

Final SHA: see `signals/G4_DONE` (the commit that adds this file), branch `v2-g4`. Written: 2026-09-27 00:15.
Started 2026-09-26 22:10. Wave 0 merged 22:55 (`0cfb58e`).

## Gate (worktree `g4`, 2026-09-27 00:05)
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build`
```
✖ 7 problems (0 errors, 7 warnings)        # all 7: i18next/no-literal-string in src/app/auth/login/page.tsx (G5)
LINT_RC=0
TSC_RC=0
 Test Files  91 passed (91)
      Tests  690 passed (690)
✓ Compiled successfully
BUILD_RC=0
```
(After the gate run, 2 more test files were added: `src/components/layout/__tests__/{service-worker,profile-prefs-sync}.test.tsx`, 5 tests, green.)

Owned e2e specs, `PORT=3104 npx playwright test e2e/{nav,a11y,profiles-ui,slice}.spec.ts --project=chromium`:
```
  5 failed
  18 passed (21.2s)
```
All 5 failures sit on routes G3 owns, and none of those routes are in the G4 branch:
- `/tools/plate-calculator` and `/tools/rm-calculator` do not exist until G3 merges. This fails 2 route tests and `no navigation link is dead`.
- `/workout` has no `data-testid="page-heading-workout"` (request G4-02). This fails 2 tests: nav `/workout` and a11y `/workout`.

The same specs in a merged tree (v2-g4 + v2-g1 + v2-g2 + v2-g3 + v2-g5 at 00:05, plus the one-line G4-02 test id on G3's `<h1>`, scratch only):
```
chromium: 23 passed (22.7s)
mobile (Pixel 7): nav + a11y + profiles-ui 21 passed (18.9s)
```
Merged-tree unit suite (same tree): `Test Files 1 failed | 210 passed (211); Tests 1822 passed`. The failed file was `pattern-label.test.tsx`, which imported `@/data` export names that G1 renamed. It was fixed in `5ca10a2` (reads the lazy catalog) and re-run in the merged tree: `Tests 5 passed (5)`.

Offline spec, production build (request G4-03 explains why it cannot run under `next dev`):
`NEXT_PUBLIC_E2E_HOOKS=1 npm run build && E2E_SERVER=prod PORT=3104 npx playwright test e2e/offline.spec.ts --project=chromium`
```
  ✓  1 [chromium] › e2e/offline.spec.ts:37:5 › a workout can be logged while offline (1.4s)
  ✓  2 [chromium] › e2e/offline.spec.ts:76:5 › an offline reload can use a catalog chunk never opened before (1.4s)
  ✓  3 [chromium] › e2e/offline.spec.ts:97:5 › an uncached route offline falls back to the offline page (560ms)
  3 passed (5.3s)
```

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| AC9 (UI: family profiles) | pass | `PORT=3104 npx playwright test e2e/profiles-ui.spec.ts --project=chromium` | 3/3 pass in g4. Covered: create, switch and delete from Settings with data isolation; the language switch applies and persists; lb display (`220.5 lb` for 100 kg). The merged tree passes too, on chromium and mobile. |
| AC11 (nav) | pass in the merged tree, partial in g4 | `e2e/nav.spec.ts` (`e2e/routes.ts` lists 9 routes) | g4: all 7 G4 routes pass, but the 2 tools routes are missing until G3 merges. Merged tree: every route returns 200, shows its heading and no error boundary, and appears in the nav; no dead links. `/workout` needs G4-02. |
| AC14 (i18n + a11y) | pass (G4 scope) | `npm test -- i18n`; `e2e/a11y.spec.ts`; `npx eslint <G4 files>` | Parity: 21 tests pass (key parity, no empty values, matching placeholders, keys unique across modules). axe finds 0 serious violations on dashboard, exercises, history and settings in g4; `/workout` also passes in the merged tree with G4-02. `userScalable:false` is removed (spec asserts it). `no-literal-string`: 0 warnings in G4 files. |
| AC15 (PWA) | pass on a production build | `e2e/offline.spec.ts` (prod server) | 3/3 pass: logging a workout offline, a catalog chunk never opened before, and the offline fallback page. The manifest has any, maskable and apple icons, and is in hr. |
| AC2 (owned lib dirs) | pass | `npx vitest run --coverage --coverage.include='src/lib/i18n/**/*.ts' …` | `lib/i18n` 100 % lines; `lib/i18n/modules` 100 %. |

## Coverage on owned dirs
Command: `npx vitest run --coverage --coverage.include='src/**' --coverage.exclude='**/__tests__/**' --coverage.reporter=text` (lines %)
```
lib/i18n 100 | lib/i18n/modules 100
components/layout 99.24 | components/ui 96.91 | components/analytics 97.23 | components/history 94.95
components/programs 94.54 (lib 99.56, manager 95.83, slot-editor 92.3) | components/settings 93.36
app/(app)/dashboard/_components 97.59 | app/(app)/exercises/_components 94.6
app/(app)/programs 90.19 ([id] 92.68, session/[sessionId] 92.3, new 81.48) | app/(app)/analytics 88.23 ([exerciseId] 80)
```
The rows at 0–77 % are the thin `page.tsx` server wrappers (metadata plus one import). `src/hooks/use-analytics.ts` is a re-export and shows 0 %.

## What was built
- **i18n**
  - `src/lib/i18n` has hr as the default. Each screen has its own module under `modules/*.ts`, with en and hr side by side, so tsc enforces parity.
  - `t(key, locale, vars)` supports interpolation. Also added: `useT()`, a kg/lb and date formatter, and `readStoredLocale`.
  - 175 keys requested by G1, G3 and G5 are merged into `modules/requests.ts`.
  - All 109 catalog movement patterns are localised.
- **Shell and a11y**
  - The dialog hook traps focus, restores it and is labelled. There are a skip link, `aria-current` nav state and SVG icons. The nav has no dead links: "Arsenal" is now `/exercises?favorites=1`.
  - Semantic Tailwind tokens (`bg-card`, `text-fg-muted`, …) replace every inline style. Muted text contrast went from 3.7:1 to 5.2:1.
  - The active profile's language and theme are applied at boot (`ProfilePrefsSync`).
- **PWA**
  - New icons (the old ones were blank), with any, maskable and apple variants, and an hr manifest and offline page.
  - The service worker precaches the shell routes and every chunk their HTML references. It caches `/_next/static` cache-first, and chunks network-first under dev.
  - The page hands the worker the chunks it has already loaded and warms every catalog chunk (`catalog.preloadAll`).
- **Dashboard:** today's predicted session, including rest days and skipping; recovery; last workout; weekly volume (ISO week, done working sets only, units applied); start and resume. It uses G3's store API.
- **Programs**
  - Install presets.
  - Builder wizard: 2–6 days × Full / Upper-Lower / PPL.
  - Per-day slot editor with muscle, station, equipment and "owned only" filters. Bodyweight gear and kettlebells count as owned equipment.
  - Edit, activate and deactivate; rotation pointer; align to a start date; delete.
- **Exercises**
  - Search and filters (modality, muscle, station, attachment), kept in the URL.
  - Favourites.
  - Detail page: videos (app.tytax, YouTube, else a search link), impact, notes, personal history, e1RM chart, not-found state.
- **History**
  - List (exercise names, sets, volume, PRs), detail, and editor. Changing the date shifts the timestamps too.
  - Soft delete with Undo.
  - Muscle impact falls back to per-set snapshots.
- **Analytics**
  - Muscle distribution and lagging muscle.
  - Per-exercise progress.
  - Bodyweight log and chart.
  - ACWR with no fake "danger" for new users.
  - Heatmap.
  - Movement balance by real catalog patterns.
  - Pinned metrics, stored per profile on the device (G4-30).
- **Settings**
  - Profiles: create, switch, rename, delete. Deleting uses type-to-confirm and warns about an open draft.
  - Language and units, applied everywhere.
  - Training defaults: rest, warm-up strategy, bar weight (decimals allowed).
  - OLED theme and equipment inventory.
  - Data: JSON backup and restore, CSV export.
  - Legacy tytax-autonomous import: preview, per-user target profile, result. It needs G4-35.
  - Sync slot `data-testid="settings-sync-slot"`.
- **Process**
  - Each screen had an implementer and an adversarial reviewer.
  - A robustness pass made tests pass against G1's renamed catalog ids and G2's settings validation, checked in both trees.
  - One refuter round: 23 findings, all reproduced. 20 were fixed with regression tests; 3 are in other goals' files and became requests.

## Requests made
Needed at integration. The G4 behaviour is wrong or missing without them:
- `G4-01`, `G4-40` (G5): LocaleProvider SSR and hydration. It renders `en` on the server and hydrates from localStorage, so every hard load in hr logs "Hydration failed". With the G4-01 file applied, the count of these errors was measured at **0**. The full replacement file is in G4-01.
- `G4-02` (G3/G5): the `page-heading-workout` test id. `nav.spec` and `a11y.spec` need it on `/workout`; verified in the merged tree.
- `G4-03` (G5): run `offline.spec` on a production build (npm script plus a CI step).
- `G4-35` (G5 applies it; the API is G2's): switch `loadLegacyImportApi` to `@/lib/import`. The verbatim adapter and an integration test using G2's fixture are in the file; 67/67 pass in the merged tree. Bodyweight CSV turns on by itself once G2's `bodyweightToCSV` is merged.

Contract and library follow-ups:
- `G4-10`: remove the old `dashboard_*` keys.
- `G4-15`: `ProgramSession.kind`.
- `G4-16`: program-template helpers.
- `G4-17`: hard remove for drafts, and a preset description.
- `G4-20`: catalog `stationId`/`attachmentIds` (partly answered by G1's catalog rename).
- `G4-21`: usage counts.
- `G4-22`: a shared video-link builder.
- `G4-25`: `startFromLog`, for "Repeat workout".
- `G4-26`, `G4-47`: `logs.update` recomputes PRs and `prCount`.
- `G4-30`: `ProfileSettings.pinnedExerciseIds`.
- `G4-31`: `lib/analytics` imports the eager catalog.
- `G4-36`: equipment "not configured" semantics, and a device-wipe method.
- `G4-37`: prefs on boot. §1 is now done by G4's `ProfilePrefsSync`; the dead keys are still open.
- `G4-41`: e1RM near 36 reps.
- `G4-52`: raw movement pattern in G3's picker.

## Unfixed findings
- **Hydration mismatch on every hard load (S2)**
  - **What:** the server renders `en` and the client hydrates to `hr`.
  - **Evidence:** "Uncaught Error: Hydration failed…" in the e2e WebServer log. It goes to 0 with G4-01 applied (measured in g4 with the file patched, not committed).
  - **Why not fixed:** `src/components/providers/locale-provider.tsx` belongs to G5.
  - **Proposed fix:** G4-01, verbatim.
- **`prCount` and PR records stale after editing a PR set (S2)**
  - **What:** after the edit, the history, detail and dashboard PR counts stay at 1.
  - **Evidence:** `docs/v2/requests/repro/G4-47-prcount-after-edit.repro.test.tsx.txt` fails today.
  - **Why not fixed:** G2's `repo.logs.update`.
  - **Proposed fix:** G4-26/G4-47.
- **e1RM blows up near 36 reps (S3)**
  - **What:** 24 kg × 35 gives 432 kg, and Best lifts ranks it first.
  - **Evidence:** G4-41 repro.
  - **Why not fixed:** G1's training engine follows the spec (Brzycki below 37 reps).
  - **Proposed fix:** cap reps for e1RM ranking, or switch to a continuous formula (owner decision).
- **Legacy import disabled in the v2-g4 branch (S2 until integration)**
  - **What:** the import button is disabled.
  - **Evidence:** `@/lib/import` is absent in v2-g4.
  - **Why not fixed:** a static import would break the build before G2 merges.
  - **Proposed fix:** G4-35, verbatim.
- **Pinned metrics are device-local (S3)**
  - **What:** pins do not sync between devices.
  - **Evidence:** G2's repo rejects unknown settings keys.
  - **Why not fixed:** the contract field needs the owner's decision.
  - **Proposed fix:** G4-30.
- **Page `<title>` metadata is English or static (S3)**
  - **What:** server `metadata` cannot see the client locale.
  - **Why not fixed:** it needs a locale cookie or header on the server, which touches G5's proxy.
  - **Proposed fix:** set a `locale` cookie in LocaleProvider and read it in `generateMetadata`.
- **Offline under `next dev` never hydrates (S3, dev-only)**
  - **Evidence:** G4-03 (`/workout` stayed on "Učitavanje..." for more than 30 s under dev; passes on a production build).
  - **Proposed fix:** G4-03.

## Given up on / not built
- Spec extras from the old app that are not in the G4 goal list: the ONLINE/STANDBY pill, streak and level tiles, and a program-load heatmap on the dashboard. Also a "Done N×" badge and "most used" sort (need G4-21), and a mobile filter bottom sheet on Exercises.
- "Repeat workout" in History waits for G3's `startFromLog` (G4-25).
- The Recovery thresholds from the old app are kept. With them, a regular trainee shows "fried" for about 31 h after a session. This is flagged in `G4-spec-dashboard-analytics.md` as an owner question.

## Estimate vs actual
- Wall clock: estimate 6–8 h; actual about 2 h 05 m (22:10 to 00:15), including 45 min waiting for Wave 0, which was spent on the i18n, PWA, shell sweep and specs.
- Agents: 5 workflow runs, 31 subagents (≤7 concurrent). No DSH/Qwen lane was used; all fan-out ran as ultracode subagents.
- Commits on `v2-g4` since the plan commit: 34 (including the Wave 0 merge and this report).

---

# Wave 2 (2026-09-27 00:20–01:40)

Merged, as instructed in `signals/WAVE2.md` and by the coordinator: `v2-w2-contracts` (twice: `1505da7`, then `7c8e087`) and `v2-g1` (G1's finished Wave 2). G4's own Wave 2 work is 14 non-merge commits.

## Gate (worktree `g4`, 01:30)
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && node scripts/check-bundle.mjs`
```
✖ 7 problems (0 errors, 7 warnings)      # all 7: i18next/no-literal-string in G5's src/app/auth/login/page.tsx
LINT_RC=0
TSC_RC=0
 Test Files  138 passed (138)
      Tests  968 passed (968)
✓ Compiled successfully
BUILD_RC=0
route /analytics: 249.8 kB gzip, catalog leak: no
route /dashboard: 245.8 kB gzip, catalog leak: no  budget 250 kB: ok
route /exercises: 241.7 kB gzip, catalog leak: no
route /history: 237.2 kB gzip, catalog leak: no
route /programs: 240.3 kB gzip, catalog leak: no
route /settings: 245.9 kB gzip, catalog leak: no
check-bundle: OK
```
After the merged-tree fixes (commit "G4 tests and adapters correct against latest G2/G3/G5"), `npx vitest run` gave `Test Files 139 passed (139); Tests 973 passed (973)`, and tsc was clean. After the final i18n fold, `npx vitest run src/lib/i18n` gave 25/25.

Owned e2e, `PORT=3104 npx playwright test e2e/{nav,a11y,profiles-ui,slice}.spec.ts --project=chromium`:
```
  5 failed
  19 passed (25.0s)
```
All 5 failures are on G3 routes, as in Wave 1: `/tools/*` is missing (2 route tests plus the dead-link test), and `/workout` has no `page-heading-workout` (G4-02), which fails nav and a11y. The new test "secondary G4 screens have no serious axe violations" passes. It covers /programs, /analytics, /analytics/[id], /exercises/[id], /history/[id] and /history/[id]/edit.

Offline, on a production build: `3 passed (5.4s)`.

Merged tree (v2-g4 + v2-g2 + v2-g3 + v2-g5 at 01:50):
- **Unit tests:** `Test Files 3 failed | 295 passed (298); Tests 5 failed | 2338 passed (2343)`. None of the 5 failures is in G4 files; see "Unfixed findings".
- **e2e:** `3 failed | 21 passed`.
  - 2 are `/workout` page-heading (G4-02, still not applied on G3's side).
  - 1 is `slice.spec.ts` quick workout. It timed out on a URL wait under full load and **passed on a solo re-run** (`PORT=3104 … -g "quick workout"`), so it is a load flake, not a defect.

## Items
| Item | Status | Evidence |
|---|---|---|
| 1 (S2) Fold pending i18n (G1/G3/G5 md tables and G3's live `strings/*.ts` tables) | done | 282 request keys in `modules/{requests,g3Tools,g3Picker,g3Workout,g3Session,g5Auth}.ts`, with hr/en parity. A drift test (`requests.test.ts`) compares G3/G5 tables with the dictionary once merged. It passes in the merged tree (25/25) and was proven non-vacuous by editing 2 values. Switch list for G5: `G4-W2-01`. Lint: the merged tree has 0 `no-literal-string`. The "52 warnings" were stale Wave 0 copies of G4 files in the other branches. |
| 2 (S2) G2-02 settings wiring + restore confirmation | done | `backup-service.ts` adapter: local path plus `fromG2Service` (passes `confirmOverwrite` only after the user acknowledges). `restore-dialog.tsx` lists each profile as new or existing, and an acknowledgement checkbox is required when a profile already exists. Error codes map to i18n; the raw-message finding is fixed. CSV passes `{units}`, and the units hint is probed from the real CSV header. The pre-migration export offer is included. Integration switch: `G4-W2-06`. |
| 3 G3-03 test ids | done | `dashboard-next-session`; `install-preset` with `data-preset-id`. |
| 4 G3-04 foreign draft | done | Dashboard card: owner name, switch to owner, confirmed discard. Settings: the draft stays with its owner on switch; deleting the owner discards the draft and says so in the confirmation. |
| 5 F8 catalog lookup | done | `use-analytics-data.ts` passes the lookup. A test shows program logs without snapshots now count muscle volume. |
| 6 F4 `/settings` < 250 kB | done | 275.3 kB (G1 measurement) down to 245.9 kB, using lazy panels. `/analytics` 250.4 down to 248.2 kB (249.8 after hardening). `/auth/login` is 292.1 kB and belongs to G5: `G4-W2-05`. |
| 7a Machine setup editor | done | `/exercises/[id]`: seat/pin/backrest/bench/cable/other. The adapter uses G2's `notes.setSetup` (present in the merged tree). On v2-g4 it is read-only with an explanation. Clearing a note asks for confirmation when a setup exists (`G4-W2-55`; G2 implemented keep-setup). |
| 7b History "Repeat workout" | done | Uses G3's `startFromLog(profileId, log)` (present in the merged tree). Hidden without it. Asks before replacing your own draft, never replaces a foreign draft, and re-checks for a draft that appeared since render (a mutation test proves the guard). |
| 7c Pinned exercises on dashboard and analytics | done | `ProfileSettings.pinnedExerciseIds` via `updateSettings`. localStorage is a fallback only for an older repo, with a one-time migration. A missing exercise shows its stored name or "removed exercise", never the raw id. |
| 7d Station filter chip row | done | Built from `catalog.stations` (7 stations incl. FRAME/FREE_WEIGHT from G1), with G1's `station_*` keys, counts and URL state. |
| 8 A11y re-check | done | e2e axe on 6 more screens: 0 serious. A damaged-entry axe unit test was added. |
| G1 follow-ups (coordinator) | done | Deleted `components/programs/lib/{load,slot-equipment}` and calendar copies in favour of `@/lib/programs/*` (thin G4-only `slot-filter` wrapper kept for gear/kettlebell ownership). `video-links.ts` now maps G1's `buildVideoLinks`. `rankableE1rm`/`E1RM_MAX_REPS`/`isTimeSet` are imported directly. Kinetic-impact explanation text is not shown anywhere in G4. |
| Time-measured sets | done | History detail and editor show and edit durations (mm:ss). Exercise detail and analytics exclude time sets from e1RM and kg volume. |

## Hardening: 2 local refuters (DSH/Qwen, `dsh --profile headless`, engine queue 0 at launch)
Reports: `docs/v2/goals/G4-W2-refuter1.md` (settings/history/dashboard) and `G4-W2-refuter2.md` (exercises/programs/analytics/i18n/sw/layout). Each finding was then reproduced with a failing vitest before its fix.

| Finding | Sev | Result |
|---|---|---|
| Restore accepts log rows without exercises/date/totals, after which /history crashes forever | S2 | reproduced and fixed: row validation (`backup-validate.ts`); stored bad rows render as a deletable "damaged entry" |
| Count and list disagree for bad rows ("Load more" dead end, `NaN kg`) | S3 | reproduced and fixed |
| A restored partial `settings` object makes every setting unsaveable | S2 | reproduced and fixed: defaults filled on restore; `settingsRepairs` on save; VALIDATION message |
| A second delete kills the first delete's undo | S3 | reproduced and fixed: undo stack, "{n} workouts deleted" |
| History page metadata hard-coded in English | S3 | reproduced and fixed |
| CSV units hint inferred from an export name | suspect | not reproduced at HEAD; hardened anyway (probe the real header) |
| Per-muscle volume exceeds kg lifted | S1 | **not reproduced** after the G1 merge: Smith drag curl 3×50×10 gives Biceps 1,380 kg (≤ 1,500), because G1's `impactWeights` max-collapse fixed it. Kept as a regression test. |
| ACWR zone changes with clock time | S2 | reproduced and fixed: day-stable `now` |
| First-week muscle shows ratio 4 / "danger" | S2 | reproduced and fixed: per-muscle baseline gate |
| Pinned card shows the raw id | S3 | reproduced and fixed |
| Bodyweight chart caption says "Best" | S3 | reproduced and fixed |
| Weekly volume % compares a partial week with a full week | S3 | reproduced and fixed: same elapsed portion of last week |
| Program editor rejects rep targets the app stores (`30s/side`, `8-12/leg`, …; 22 of 71 distinct values) | S2 | reproduced and fixed: free text of 1–24 characters |
| Preset slots missing from the catalog are invisible in the slot editor | S2 | reproduced and fixed: an "unknown slots" section. Missing preset ids after the G1 merge: **0 of 112** (the refuter measured 15 before the merge). |
| The same e1RM shows different lb values on two screens | S3 | reproduced and fixed |
| Clearing a note wipes the machine setup | S3 | reproduced; G2 fixed it after `G4-W2-55`; G4 shows a confirmation |
| PR count stale after an edit | S2 | already G4-47; G2 Wave 2 item 1 |
| LocaleProvider shows English on first paint | S3 | already G4-01/G4-40 (G5) |

## Requests (Wave 2)
- `G4-W2-01` (G5): switch the G3/G5 local string tables to the dictionary.
- `G4-W2-05` (G5): `/auth/login` is 292.1 kB.
- `G4-W2-06` (G5, integration): backup-service switch to G2's service.
- `G4-W2-07` (G5): the `settings-account` test id in G5's tests.
- `G4-W2-15` (G3, landed): `startFromLog`.
- `G4-W2-16` (G2): the repo stores e1RM on time sets.
- `G4-W2-20` (G2, landed): `notes.setSetup`.
- `G4-W2-30`: analytics lookup and time sets, no switch needed.
- `G4-W2-40` (G1/G2): restore row validation in `importBackup`.
- `G4-W2-45` (G1): day-stable ACWR and a per-muscle baseline in the engine.
- `G4-W2-55` (G2, landed): clearing a note keeps the setup.

## Unfixed findings (Wave 2)
- **G3 tests fail once G2 is merged (S3, test-only)**
  - **What:** `src/stores/__tests__/setup-adapter.test.ts` (3 tests) and `src/hooks/__tests__/use-workout-w2.test.ts` (1 test) fail in the merged tree and pass in v2-g3 alone.
  - **Evidence:** `AssertionError: expected true to be false` at `setup-adapter.test.ts:43`.
  - **Why not fixed:** G3's files. The tests assume a repo without `notes.setSetup`, which G2 now provides.
  - **Proposed fix:** G3 or G5 updates those tests at integration. The coordinator was told at 01:50.
- **G5 settings test waits for a removed test id (S3, test-only)**
  - **What / evidence:** `settings-flag-off.test.tsx` waits for `settings-account`.
  - **Why not fixed:** G5's file.
  - **Proposed fix:** `G4-W2-07`, a one-line change.
- **Hydration mismatch (S2)**
  - **What:** as in Wave 1; still present.
  - **Proposed fix:** G4-01/G4-40.
- **`/workout` page-heading test id missing (S3)**
  - **Proposed fix:** G4-02.
- **Load flake in `slice.spec.ts` (S3)**
  - **What:** URL-wait timeout when 5 goals run e2e on one machine.
  - **Evidence:** passes solo.
  - **Proposed fix:** none in G4. If it recurs in CI, G5 could raise the navigation timeout.

## Estimate vs actual (Wave 2)
- Wall clock: 00:20 → about 01:55 (deadline 03:30).
- Agents: 6 workflow runs, 18 Claude subagents (at most 6 concurrent), plus 2 local DSH/Qwen refuters.
