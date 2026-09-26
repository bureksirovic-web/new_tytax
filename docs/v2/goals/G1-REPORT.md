# G1 report — Wave 0 foundation, exercise data and the training engine

Branch `v2-g1`. Written 2026-09-26 23:50 CEST. Final SHA: see `~/Projects/tytax-v2/signals/G1_DONE`
(this report is part of that commit).

## Verdict
- **Wave 0: done.** Signalled 22:52 (`0cfb58e`, branch `v2-wave0`), 45 min after start against a ≤ 3 h target; gate green.
- **Phase B: done except one clause.** AC5/AC6 (unit), AC7 and AC2 pass. AC8 passes every clause except
  "unresolved stations ≤ 5 %": **145 of 1,436 = 10.1 %** (cap 71). Cause and proposed fix: finding F1.
- Two adversarial reviews ran (Wave 0 after the signal; Phase B at the end). Every S1/S2 claim got a refuter
  that tried to reproduce it. All G1-owned findings are fixed; findings in other goals' files are handed off in
  `docs/v2/requests/G1-03-wave0-review-handoff.md` (also `signals/WAVE0_REVIEW.md`).

## Gate (final, in this worktree)
Command:
`npm run lint && npx tsc --noEmit && npm test && npm run build && npm run check-bundle && npm run catalog:build -- --check && PORT=3101 npx playwright test e2e/slice.spec.ts --project=chromium`
```
GATE_EXIT=0
✖ 52 problems (0 errors, 52 warnings)          # all i18next/no-literal-string warnings (rule is warn until integration)
 Test Files  56 passed (56)
      Tests  459 passed (459)
✓ Compiled successfully in 707ms
first-load JS for /dashboard: 204.8 kB gzip (budget 250 kB), 13 files
check-bundle: OK
catalog: source 1436, excluded 27, catalog 1409, unresolved 145 (10.1% of 1436); provenance {"t1x-meta":284,"name-rule":957,"manual":23}
  2 passed (8.7s)                                 # e2e/slice.spec.ts, chromium, PORT=3101
```
G1 owns no e2e spec besides the Wave 0 slice (`e2e/slice.spec.ts`).

## Phase A — Wave 0 (PLAN §10.1)
| Item | What landed |
|---|---|
| W0.1 | `CLAUDE.md`/`AGENTS.md` of the repo: the A–I ownership rules replaced by the §10.3 table; stack and rules updated. |
| W0.2 | `playwright.config.ts`: `PORT`, `reuseExistingServer:false`, `-H 127.0.0.1`; `/api/health` returns the git SHA (`next.config.ts` → `NEXT_PUBLIC_GIT_SHA`); `e2e/global-setup.ts` fails the run if the served SHA ≠ worktree HEAD. |
| W0.3 | `src/contracts/{domain,repo,training,exercise-catalog,sync,fixtures}.ts`; `src/types/**` re-exports them. Repo contract: atomic idempotent `finishWorkout`, transaction, `watch` (liveQuery), typed `RepoError`, default soft-delete filter, `activeProfileId` on the profile, account vs family profile identity, units (kg stored). |
| W0.4 | Real vertical slice: Dexie v3 repository (all methods), lazy per-modality catalog, persisted workout draft with nested sets (duplicate exercises work), quick workout → reload → finish → debrief → history. |
| W0.5 | `e2e/fixtures` API (`gotoApp`, `reset`, `seedProfile`, `seedHistory`, `seedProgram`, `listLogs`, `snapshot`) via `window.__tytaxE2E`; ≥ 3-expects fixture; ESLint bans visibility/count guards, `waitForTimeout`, `.skip/.only/.fixme/.todo`; `i18next/no-literal-string` at warn; CI skeleton. |
| W0.6 | `middleware.ts` → `proxy.ts`; deps added: zod, @axe-core/playwright, eslint-plugin-i18next, fake-indexeddb, supabase CLI, tsx, @testing-library/user-event; Next 16.2.1 → 16.3.6 (fixes the critical advisory). |

Wave 0 gate (pasted in `signals/WAVE0_DONE`):
```
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3101 npx playwright test e2e/slice.spec.ts --project=chromium
added 541 packages, and audited 542 packages in 8s
✖ 52 problems (0 errors, 52 warnings)
 Test Files  52 passed (52)
      Tests  382 passed (382)
✓ Compiled successfully in 410ms
  2 passed (7.9s)
```
Handoff guide for G2–G5: `docs/v2/WAVE0.md`.

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| AC5 (unit) progression | pass | `npx vitest run src/lib/training/__tests__/progression.test.ts` | `Tests 13 passed (13)` — RIR ≥ 3 → +2.5 kg; RIR 2 → +1.25 kg; RIR 1 → hold; ghost reps; no history; soft-deleted newest ignored; drop set does not block; 0 kg bodyweight; kettlebell bells |
| AC5 (unit) warm-ups | pass | `npx vitest run src/lib/training/__tests__/warmups.test.ts` | standard / heavy / pyramid (the original app's percentages: standard 50 %×10, 75 %×5; heavy 50×10, 75×5, 85×3, 95×1; pyramid 40×12, 60×8, 80×4) |
| AC6 (unit) PRs | pass | `npx vitest run src/lib/training/__tests__/prs.test.ts src/lib/db/__tests__/finish-workout.test.ts` | `Test Files 2 passed (2) Tests 18 passed (18)` — baselines not celebrated; strictly greater only; warm-ups/undone excluded; e1RM PRs only ≤ 12 reps; reps PRs at 0 kg; persisted in `prRecords` by `finishWorkout` |
| AC7 analytics correctness | pass | `npm test -- analytics` | `Test Files 8 passed (8) Tests 67 passed (67)` — `ac7-correctness.test.ts`: real 48 h window (47 h counts, 49 h not, across midnight), ACWR/volume/impact over done working sets of live logs, program logs without snapshot counted via the catalog; every value hand-derived in a comment |
| AC8 data integrity | **partial** | `npm test -- data-integrity` | `Tests 13 passed (13)`: every preset id resolves; 0 "Tytax" stations; every station/attachment a `tytax_library.json` id with provenance; every unresolved entry listed against 1,436; outputs equal a fresh deterministic build; ids stable; lazy-import guard + self-test. **The ≤ 5 % clause fails (145 = 10.1 %)**; the test only ratchets it (≤ 145) and checks the proposed amended criterion (ambiguous machine exercises 28 = 1.9 %). See F1. |
| AC8 bundle | pass | `npm run build && npm run check-bundle` | `first-load JS for /dashboard: 204.8 kB gzip (budget 250 kB), 13 files` … `check-bundle: OK`; catalog-leak scan over all 18 routes (chunks, preload links, inline HTML/RSC): no leak |
| AC2 coverage (owned dirs) | pass | see below | 97.85 % lines on G1-owned lib code (target ≥ 70 %) |

AC8 test list (verbose):
```
✓ every preset exercise id resolves in the catalog
✓ no TYTAX exercise has the generic station "Tytax"
✓ every station and attachment is a valid tytax_library.json id with a provenance
✓ every exercise without a station is listed in docs/v2/station-unresolved.md against 1,436
✓ ratchet: the unresolved count never grows (AC8 "≤ 5 %" is NOT met: 145 of 1,436 = 10.1 %)
✓ proposed amended criterion: machine exercises with an unknown station are ≤ 5 % of 1,436
✓ accounts for all 1,436 source entries: catalog + excluded non-exercises
✓ ids are unique and stable: every pre-v2 id is kept unless its entry is not an exercise
✓ the legacy-name map resolves every value and covers the original master list
✓ videos list app.tytax first, then YouTube
✓ committed outputs equal a fresh deterministic build (npm run catalog:build -- --check)
✓ the catalog is lazy: exercise arrays are reachable only through the chunk loader
✓ the lazy-import scanner flags every way of pulling in an exercise array
```

## Coverage on owned dirs
Command: `npx vitest run --coverage --coverage.include='src/lib/{training,analytics,catalog,programs,workout}/**' --coverage.include=src/lib/constants.ts --coverage.include=src/lib/utils.ts --coverage.include=src/hooks/use-exercises.ts`
```
File               | % Stmts | % Branch | % Funcs | % Lines
All files          |   96.06 |    90.48 |    96.7 |   97.85
 hooks             |   94.28 |    81.48 |    92.3 |   96.55
 lib               |   94.11 |     92.5 |   92.85 |   96.42
 lib/analytics     |   95.53 |    85.71 |   97.91 |   96.06
 lib/catalog       |   93.12 |     87.9 |    92.5 |   97.56
 lib/programs      |     100 |    92.85 |     100 |     100
 lib/training      |   98.25 |    95.56 |     100 |     100
 lib/workout       |     100 |      100 |     100 |     100
```

## Phase B — what was built
1. **Catalog build** (`scripts/data/build-catalog.ts`, `npm run catalog:build [-- --check]`): regenerates
   `src/data/tytax/{exercises,legacy-names,library,original-plan}.json` from vendored copies of the tytax-autonomous
   sources (`scripts/data/source/`, @ f4a4733). Deterministic (checked by a test). Stable ids via
   `scripts/data/id-registry.json`: all 1,420 pre-v2 ids kept except 11 promo videos. `legacyName` = the
   "TYTAX T1 | X" master name or the plain name; `legacy-names.json` maps every legacy form (+1 reviewed alias) to an
   id; `catalog.getByLegacyName` covers all of them. `t1xNumber`, `techniqueLevel` from `exerciseLevel`, videos
   ordered app.tytax → YouTube.
   **Reconciliation 1,436 vs 1,420** (`docs/v2/catalog-reconciliation.md`): 27 source entries are promo/delivery/
   overview videos (source metadata: no `exerciseLevel`, T1-X number ≤ 13) and are excluded; 1,409 exercises remain.
   new_tytax had dropped 16 of those videos and kept 11 (now dropped); 5 odd-named real exercises are kept (4 with a
   reviewed display name, e.g. `NEvUVCFF8x8` → "Triceps Elbow Extension (T1-X #1590)").
2. **Station remap** (`scripts/data/station-rules.ts`): station ids are `tytax_library.json` STATIONS keys; attachment
   ids derive from RECOMMENDED_ATTACHMENTS. Provenance: `t1x-meta` 284 (specific source station), `name-rule:<id>`
   957 (21 ordered rules, rationale in `docs/v2/station-unresolved.md`), `manual` 23 (first pass by local Qwen via
   DSH on the 185-entry residual, 56 s; I accepted only suggestions with a concrete cue, rejected e.g. barbell/EZ-bar →
   Smith). Unresolved 145, listed by cause. Seed-42 sample of 50 remapped entries for morning review:
   `docs/v2/station-sample.md`.
3. **Presets:** the original app's INITIAL_PLAN is the default TYTAX program (`DEFAULT_TYTAX_PRESET_ID =
   'tytax-original-6day'`: Upper A, Lower A, Upper B, Lower B, Upper C, Lower C, Rest Day; 33 exercises all resolved).
   Tytax Elite v3.0 kept, its 15 dangling exercise ids re-pointed to the closest real exercises. Every preset id resolves (test).
4. **Lazy loading:** catalog chunked per modality (dynamic imports only in `src/lib/catalog/chunks.ts`); eager barrels
   removed; `scripts/check-bundle.mjs` sums gzip of the /dashboard first-load set (build manifest root files ∪ the
   route's client-reference `entryJSFiles` ∪ HTML script/preload tags) and scans every route for catalog data.
5. **Training engine** (`src/lib/training`, `TrainingApi`): e1RM Brzycki (Epley at 37+); warm-ups standard/heavy/
   pyramid (original app's tables); prefill RIR ≥ 3 → +2.5 kg, RIR 2 → +1.25 kg, ghost reps, working sets only,
   bodyweight holds kg, kettlebells snap to real bells (`availableKg`); PR detection over done working sets (e1RM ≤ 12
   reps, weight, reps at 0 kg; baselines not celebrated); impact distribution + lagging muscle (`IDEAL_DISTRIBUTION`);
   recovery with a real 48 h timestamp window; ACWR over done sets of live logs with a cold-start rule; deload −1 set,
   −15 %.

## Requests made
- `docs/v2/requests/G1-02-training-contract.md` — additive `PrefillOptions.availableKg`; clarified prefill/PR/ACWR semantics.
- `docs/v2/requests/G1-03-wave0-review-handoff.md` — 36 Wave 0 review findings routed to owners (27 for G2/G3/G5/contracts; G1's fixed).
- `docs/v2/requests/G1-04-catalog-handoff.md` — station ids, preset default, legacy-name map, analytics `lookup`, bundle notes (also `signals/G1_NOTES.md`).
- `docs/v2/requests/G1-i18n.md` — 46 keys with hr/en (Wave 0 UI strings, station/attachment names, preset name).
- The four peer sessions were messaged once with pointers to the two signal files.

## Unfixed findings
- **F1 — AC8 "unresolved ≤ 5 %" not met.** What: 145 of 1,436 (10.1 %) TYTAX entries have no station.
  Evidence: `docs/v2/station-unresolved.md` — free weights 36, bodyweight on the frame (pull-up/dip handles, hanging)
  25, pure bodyweight 19, stretches 37, ambiguous machine moves 28 (1.9 %). Why not fixed: `tytax_library.json`
  STATIONS has only SMITH / BACK_UPPER / BACK_LOWER / LEG_EXTENSION / LEG_CURL; forcing these entries onto them would be
  the "arbitrary station" the AC forbids. The T1-X app (app.tytax.com) sits behind a Vercel bot checkpoint, so its
  metadata could not be used. Proposed fix (owner decides): either add FRAME (pull-up/dip handles, bench) and
  FREE_WEIGHT stations to the library, or amend AC8 to "machine exercises with an unknown station ≤ 5 %" (met: 1.9 %,
  asserted by a test). S3.
- **F2 — Time-measured sets are not expressible.** What: 92 catalog entries have time targets (74 TYTAX, 12
  bodyweight, 6 kettlebell, e.g. "Smith Bar Static Hold 20-40s"); a set can only store seconds as `reps`, so volume
  counts kg × seconds. Evidence: Wave 0 review R18. Why not fixed: needs contract fields used by G2 (totals) and G3
  (input). Proposed fix: optional `Exercise.measure?: 'reps'|'time'` and `SetEntry.durationSeconds?`, tag the entries in
  the catalog build, skip e1RM/volume for time sets. S2.
- **F3 — Stored `set.e1rm` and the history detail still use unreliable high-rep e1RM.** What: `finishWorkout`
  stores `e1rm` for every set (G2 `src/lib/db/repo/finish.ts`); history detail shows it. PRs and analytics now ignore
  sets > 12 reps. Proposed fix: G2 stores `e1rm` only for sets ≤ `E1RM_MAX_REPS` (exported from `@/lib/training`). S3.
- **F4 — First-load JS over 250 kB on /settings (275.3 kB) and /auth/login (263.6 kB).** Not AC8's route. Evidence:
  `npm run check-bundle` route lines. Proposed fix (G4/G5): dynamic-import the Supabase client / auth code. S3.
- **F5 — `npm audit --audit-level=high` fails on 5 transitive advisories** (brace-expansion, browserslist, js-yaml,
  undici, vite). Why not fixed: `npm audit fix` / `npm update` crash with npm 10.9.8 arborist
  (`Cannot read properties of null (reading 'edgesOut')` in `#loadPeerSet`); lockfile regeneration hit the same bug.
  Proposed fix (G5 at integration): retry with a newer npm or add `overrides` for the five packages. The CI security job
  fails until then. S2.
- **F6 — Station mapping rests on domain assumptions that need owner review.** "Sled" = the Smith carriage; lever
  arms loaded from the lower pulley unless pulling down; ski/poling = upper pulleys; 23 manual mappings (hammer/jammer/
  bench-push presses on the Smith carriage). Evidence: rules table in `docs/v2/station-unresolved.md`, sample in
  `docs/v2/station-sample.md`. Proposed fix: owner marks the 50-row sample; corrections go into
  `scripts/data/station-manual.json`. S3.
- **F7 — Wave 0 review findings in other goals' files** (27 items: e.g. v2→v3 migration orphans `'local'` data (G2),
  PR bests only from stored records (G2), decimal comma saved as 0 kg (G3), draft not scoped to the profile (G3), rest
  session dead-ends the rotation (G3), lint/expect-count bypasses (G5)). Evidence and fixes:
  `docs/v2/requests/G1-03-wave0-review-handoff.md`. Why not fixed: ownership. S2/S3 each as listed.
- **F8 — Analytics consumers must pass the catalog lookup.** `computeWeeklyVolume`, `volumeByMuscle`,
  `analyzeMuscleGaps`, `computeVolumeParity` read muscle impact from the lazy catalog; without `lookup` program logs
  (no snapshot) add no muscle volume. G4 `use-analytics-data.ts` should pass it (G1-04). S3.

Refuted by the reviews (dropped, with the verifier's measurement):
- "Elite v3 woodchop fix swapped the pulley": the old id `tytax_back-lower-pulley_woodchop` resolved to nothing, so no
  pulley was swapped. The slot now points to the lower-pulley "Lower Pulley Low-to-High Woodchop", which matches the
  dangling id's intent.
- "prefill snaps RIR 2 (+1.25 kg) to a full bell": no caller passes `availableKg` yet, and bells cannot move by
  1.25 kg; this is the documented contract behaviour.

## Given up on
- T1-X app metadata as a station source: bot-protected; not bypassed.
- Time-measured sets (F2): contract-level, cross-goal; left for the morning.

## Estimate vs actual
| | Estimate | Actual |
|---|---|---|
| Wave 0 wall clock | ≤ 3 h (GOALS) / 2–3 h (PLAN §10.6) | 45 min (22:08 → 22:52) |
| Phase B wall clock | not separately estimated | ~1 h (22:52 → 23:50) |
| Paid tokens (Claude, subagents) | not estimated per goal | ~5.4 M subagent tokens across 5 workflows (build 1.23 M, Wave 0 review 2.20 M, Phase B review 1.73 M, fixes 0.20 M) plus this session |
| Local lane | first classification pass | 1 DSH/Qwen call, 56 s |

---

# Wave 2 (2026-09-27, coordinator-issued, owner-authorised)

Started 00:25 with `git merge v2-w2-contracts` (additive contract fields only; clean merge `1408f13`).
Final SHA: see `signals/G1_DONE`.

## Gate (Wave 2, in this worktree)
Command: `npm ci && npm audit --audit-level=high && npm run lint && npx tsc --noEmit && npm test && npm run build && npm run check-bundle && npm run catalog:build -- --check && PORT=3101 npx playwright test e2e/slice.spec.ts --project=chromium`
```
5 vulnerabilities (1 low, 4 moderate)
5 vulnerabilities (1 low, 4 moderate)
✖ 52 problems (0 errors, 52 warnings)
 Test Files  64 passed (64)
      Tests  529 passed (529)
✓ Compiled successfully in 727ms
first-load JS for /dashboard: 204.9 kB gzip (budget 250 kB), 13 files
check-bundle: OK
catalog: source 1436, excluded 27, catalog 1409, unresolved 28 (1.9% of 1436), no station by design 53, without station 81 (5.6% of 1436); provenance {"t1x-meta":284,"name-rule":1021,"manual":23}; time-measured 74
  2 passed (7.9s)
GATE_EXIT=0
```
(npm audit exits 0 at `--audit-level=high`; the remaining 1 low + 4 moderate are below the CI threshold.)

## Items
| # | Item | Status | Command | Output excerpt |
|---|---|---|---|---|
| 1 (S2) | F2 time-measured sets | done | `npx vitest run src/lib/training/__tests__/time-sets.test.ts src/lib/analytics/__tests__/time-sets.test.ts` | `Tests 26 passed (26)` |
| 1 | …catalog tagging | done | `npm run catalog:build` + data-integrity "time-measured sets" test | `time-measured 74` TYTAX + 12 bodyweight + 6 kettlebell = **92** tagged `measure:'time'`; list: `docs/v2/time-measured.md` |
| 2 | F3 / G4-41 rankable e1RM | done | same time-sets test file (`rankableE1rm` table) | 100×5 → 112.5; 100×12 → 144; 100×13, 0 kg, 0 reps, time set, warm-up, undone → undefined |
| 3 | F1 FRAME / FREE_WEIGHT stations | done | `npm test -- data-integrity` | `Tests 16 passed (16)`; unresolved machine moves **28 = 1.9 %** of 1,436 (AC8 5 % clause now asserted for real); without any station **81 = 5.6 %** (53 by design: 37 stretches + 16 free-standing bodyweight) |
| 4 | New: `orderByStation` | done | `npx vitest run src/lib/workout/__tests__/order-by-station.test.ts` | 8 tests incl. 200 seeded cases: never increases station changes, reaches distinct−1 without supersets, supersets whole |
| 5 | G4-16 / G4-15 program helpers | done (lib only) | `npx vitest run src/lib/workout src/lib/programs src/lib/catalog/__tests__/video-links.test.ts` | `Test Files 9 passed (9) Tests 61 passed (61)` |
| 6 | G4-22 video links | done | (in the command above) | `buildVideoLinks` / `primaryVideoLink` in `@/lib/catalog` |
| 7 | F5 npm audit | done | `npm audit --audit-level=high` | exit 0 (5 vulnerabilities: 1 low, 4 moderate) |
| extra | G4-31 / N5 kinetic impact codes | done | `npx vitest run src/lib/analytics/__tests__/kinetic-impact.test.ts` | `Tests 6 passed (6)`; `explanationKey` `ki_*` |

### Item notes
- **F2:** a time set is a `SetEntry` with `durationSeconds > 0` (`isTimeSet`). Time sets count as sets for impact, recovery,
  ACWR and lagging muscle; they never produce e1RM, weight or reps PRs, and never add kg volume. `holdSeconds(sets)`,
  `logHoldSeconds(log)` total the hold time of done non-warm-up time sets. Prefill keeps kg progression for weighted holds
  and never turns seconds into ghost reps (a ghost-duration hint needs a contract field: request G1-W2-01).
- **F3:** `e1rm()` is unchanged (the contract formula; the 1RM tool may still show high-rep estimates, G3 warns).
  `rankableE1rm` is the single rule used by `detectPRs` and the analytics best-lifts / e1RM chart.
- **F1:** FRAME ("pull-up/dip handles, bench on the frame, hanging") and FREE_WEIGHT are app-level stations in
  `src/data/tytax/library.json` (their `notes` say so; the other five stay the `tytax_library.json` keys). 64 entries were
  remapped by name rule (`name-rule:free-weight` 36, `name-rule:frame` 25, `name-rule:frame-bench` 3). Of the 1,264 exercises
  that already had a station, **0** changed. Stretches and free-standing bodyweight moves have no station by design
  ("NONE"). Frame exercises keep `requiresEquipment` (pull-up bar 16, dip station 4, the machine 8).
- **orderByStation:** SMITH → BACK_UPPER → BACK_LOWER → LEG_EXTENSION → LEG_CURL → FRAME → FREE_WEIGHT → no station;
  stable within a station; a superset block moves as one, placed by its first member. If that placement would add a
  station change (a cross-station superset), the input order is kept, so the result never has more changes than the input.
- **Program helpers (G4-16/G4-15):** `@/lib/programs/{load,session-kind,equipment,calendar}` are ports of G4's local, tested
  helpers (same behaviour, same test values). `ProgramSession.kind` is not in the contract (G4-15 not granted);
  `sessionKind` reads it through a local intersection type, then en/hr name keywords, then split position.
- **F5:** version-scoped `overrides` in package.json (brace-expansion@^1 1.1.21, brace-expansion@^5 5.0.12, browserslist
  4.29.1, js-yaml 4.3.2, undici 7.30.0, vite 8.0.16), each inside its dependents' ranges. The lockfile was written with
  `npx npm@11` because npm 10.9.8 crashes (`edgesOut`); npm 10 `npm ci` installs it. One isolated commit naming F5.

## Requests made (Wave 2)
- `docs/v2/requests/G1-W2-01-followups.md` (also `signals/G1_W2_FOLLOWUPS.md`): G2 `finish.ts` e1rm via `rankableE1rm` and
  `computeTotals` skipping time sets; G3 `use-pr.ts` and `workout-selectors.ts` time sets, `orderByStation` usage; G4 station
  filter (7 stations), swap local program helpers and video links; contract gap `SetEntry.ghostDurationSeconds`.
- `docs/v2/requests/G1-i18n.md`: + `station_FRAME`, `station_FREE_WEIGHT`, 6 `ki_*` keys (54 keys total).
- API signatures were shared with the peer sessions up front (`signals/G1_NOTES.md`, "Wave 2 API").

HARDENING_PLACEHOLDER
