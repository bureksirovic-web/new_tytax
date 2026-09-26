# G3 report — the workout loop (daily core flow)

Final SHA: see `signals/G3_DONE` (this report is the last commit on `v2-g3`; code SHA `a102e43`). Written: 2026-09-26 23:58.

## Gate
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && PORT=3103 npx playwright test e2e/workout-*.spec.ts e2e/program-rotation.spec.ts e2e/progression.spec.ts e2e/pr.spec.ts e2e/tools.spec.ts e2e/slice.spec.ts --project=chromium`
```
✖ 53 problems (0 errors, 53 warnings)        # all i18next/no-literal-string, none in G3 files (eslint on G3 paths + e2e prints nothing)
tsc: exit 0
 Test Files  97 passed (97)
      Tests  776 passed (776)
✓ Compiled successfully
Running 24 tests using 24 workers
  ✓ e2e/workout-quick.spec.ts › quick workout logs three sets, survives a reload and is saved with its debrief
  ✓ e2e/program-rotation.spec.ts › finishing the first program session advances /workout to the second
  ✓ e2e/program-rotation.spec.ts › a rest session is completed from /workout and the rotation wraps to the first session
  ✓ e2e/progression.spec.ts › RIR 3 adds 2.5 kg, RIR 2 adds 1.25 kg, and ghost reps mark a beaten set
  ✓ e2e/progression.spec.ts › standard / heavy / pyramid warm-up strategy generates 2 / 4 / 3 warm-up sets (3 tests)
  ✓ e2e/progression.spec.ts › 'none' warm-up strategy adds no warm-ups; the manual button adds one 50% set
  ✓ e2e/pr.spec.ts › beating the stored best e1RM celebrates the PR and persists it
  ✓ e2e/pr.spec.ts › a heavier warm-up or undone set is not a PR: straight to history
  ✓ e2e/pr.spec.ts › a first-ever exercise is a baseline: no celebration
  ✓ e2e/tools.spec.ts › plate calculator: 100 kg on a 20 kg bar is 25 + 15 per side
  ✓ e2e/tools.spec.ts › 1RM calculator: 100 kg × 5 estimates 112.5 kg
  ✓ e2e/tools.spec.ts › rest timer starts at the profile default, takes +30 s and counts down
  ✓ e2e/tools.spec.ts › swap: picking a suggestion replaces the exercise on the card
  ✓ e2e/workout-loop.spec.ts › the same exercise added twice logs independently
  ✓ e2e/workout-loop.spec.ts › reordering moves the card and survives a reload
  ✓ e2e/workout-loop.spec.ts › deleting sets: an empty set goes at once, a logged one asks first
  ✓ e2e/workout-loop.spec.ts › video button: app.tytax link, YouTube links in a menu, YouTube search fallback
  ✓ e2e/workout-loop.spec.ts › a draft survives a reload with its rest timer still running
  ✓ e2e/workout-foreign-draft.spec.ts › a draft started on profile A is not continued or saved as profile B; switching back resumes it
  ✓ e2e/workout-foreign-draft.spec.ts › a foreign draft is discarded only after a confirm, and B can then start its own workout
  ✓ e2e/slice.spec.ts › quick workout survives a reload and lands in history
  ✓ e2e/slice.spec.ts › a seeded history shows in the history list
  24 passed (13.8s)
```
Earlier runs: 20/20 and 60/60 with `--repeat-each=3` (before the review-fix pass); every spec ≥3 expects (fixture-enforced).

## Owned acceptance criteria
| AC | Status | Command | Output excerpt |
|---|---|---|---|
| AC3 quick workout | pass | `PORT=3103 npx playwright test e2e/workout-quick.spec.ts --project=chromium` | `✓ quick workout logs three sets, survives a reload and is saved with its debrief` |
| AC4 program workout | partial | `… e2e/program-rotation.spec.ts` | `✓ finishing the first program session advances /workout to the second`, `✓ a rest session is completed … wraps`. Program is seeded with `DEFAULT_TYTAX_PRESET_ID` via the fixture, not installed through the programs UI; prediction asserted on `/workout`, not the dashboard (G4 testid missing; request G3-03) |
| AC5 progression (e2e) | pass | `… e2e/progression.spec.ts` | `✓ RIR 3 adds 2.5 kg, RIR 2 adds 1.25 kg, and ghost reps mark a beaten set`; warm-ups standard 2 (52.5, 77.5), heavy 4, pyramid 3, none 0 |
| AC6 PRs (e2e) | pass (prRecords read via unit test) | `… e2e/pr.spec.ts` | `✓ beating the stored best e1RM celebrates the PR and persists it` (asserts `prCount 2`, `set.isPR`); warm-up/undone → no PR; baseline → no celebration. Direct `prRecords` read needs a G5 fixture hook (G3-03) |
| AC11 tool interactions | pass | `… e2e/tools.spec.ts` | plate `25 + 15 per side`; 1RM `112.5`; timer `1:30 → +30 s → 2:00 → counts down`; swap replaces the exercise (top suggestion same muscle group) |
| AC2 on `src/stores` | pass | `npx vitest run src/stores --coverage --coverage.include='src/stores/**'` | `All files | 98.38 | 96.61 | 98.37 | 99.73` |

Extra behaviour built (GOALS G3 items): deload offer when recovery is `fried` (−1 set, −15 %, warm-ups rebuilt); opt-in weak-point injector (+2 sets of a primary exercise for the lagging muscle, inventory-aware, only when `fresh`); prefill with kettlebell `availableKg`; ghost reps + "beat it"; swap suggestions by muscle/pattern with name search; picker over the lazy catalog with modality/muscle filters; duplicate exercise and reorder; persisted draft and persisted timestamp-based rest timer (vibration, single AudioContext beep, optional voice); wake lock with re-acquire; ≥44 px targets and keyboard flow; debrief with RPE 6–10 and notes; PR celebration only for non-baseline PRs; video button app.tytax → YouTube → search; foreign-profile draft handling; rest-day completion; empty-workout guard; decimal-comma input.

## Coverage on owned dirs
Command: `npx vitest run --coverage --coverage.include='src/stores/**' --coverage.include='src/components/workout/**' --coverage.include='src/components/tools/**' --coverage.include='src/hooks/use-{workout,pr,timer}.ts' --coverage.include='src/app/(app)/{workout,tools}/**' --coverage.exclude='**/__tests__/**'`
```
Statements   : 96.74% ( 1723/1781 )
Branches     : 92.72% ( 1160/1251 )
Functions    : 96.86% ( 525/542 )
Lines        : 98.22% ( 1441/1467 )
```

## Requests made
- `docs/v2/requests/G3-i18n.md`: every new UI string with en + hr (tables in `src/components/workout/strings/*.ts` and `src/components/tools/tools-strings.ts`, with parity tests). Blocking: no; G4/G5 fold them into the dictionary at integration.
- `G3-01.md` (G5): export `Page`/`Locator` types from `e2e/fixtures`. Not blocking (specs derive the types).
- `G3-02.md` (G2/G5): seeded or imported history carries no `prRecords`, so the first PR after an import is a baseline. Not blocking for G3 specs (they use a real finished workout as the baseline), but real for users with imported history.
- `G3-03.md` (G4 + G5): dashboard `dashboard-next-session` and programs `install-preset` testids; a `listPRRecords` fixture hook. Needed to close AC4/AC6 fully end-to-end.
- `G3-04.md` (G4): foreign workout draft on the dashboard and in the settings profile switcher/delete.

## Unfixed findings
- **What:** AC4 not proven through the programs UI and the dashboard. **Evidence:** `e2e/program-rotation.spec.ts` seeds with `tytax.seedProgram`. **Why not fixed:** the testids live in G4 files. **Proposed fix:** G3-03, then change the spec to install via UI and assert `dashboard-next-session`.
- **What:** `prRecords` not read end-to-end. **Evidence:** `e2e/pr.spec.ts` asserts `prCount` / `isPR` only. **Why not fixed:** fixture (G5). **Proposed fix:** G3-03 `listPRRecords`.
- **What:** PRs after an imported history are baselines. **Evidence:** G3-02. **Why not fixed:** repo/import (G2). **Proposed fix:** derive existing bests from history when no PR record exists, or write PR records on import.
- **What:** `training` ids throw without `crypto.randomUUID` on plain-http LAN until v2-g1 merges. **Evidence:** `src/lib/training/common.ts:36` on this branch. **Why not fixed:** G1-owned; fixed in v2-g1. **Proposed fix:** merge v2-g1 (integration).
- **What:** set-row inputs at 360 px: each ≈48 px wide after wrapping, but a value like "102.5" can be slightly clipped. **Evidence:** fix-stage note; not measured in a browser. **Why not fixed:** needs a visual pass. **Proposed fix:** G4 a11y/axe pass on /workout/active at mobile width.
- **What:** 1RM tool and live e1RM use the contract formula (Brzycki ≤36, Epley ≥37), which grows steeply at 30–36 reps. **Evidence:** `training.e1rm(100,36)=3600`. **Why not fixed:** contract behaviour; the tool shows an "unreliable above 12 reps" hint and PRs are capped at ≤12 reps in v2-g1. **Proposed fix:** contract owner decides whether `e1rm` itself should cap.
- **What:** `countsAsWork` now also requires reps > 0; `history/[id]` (G4) imports it and will no longer count 0-rep sets. **Why:** aligns with `training` (`isDoneWorkingSet`). Intentional; noted for G4.

## Given up on
- Nothing given up. Mobile Playwright project not run by G3 (chromium only, per the goal).

## Estimate vs actual
- Wall clock: est 6–8 h (PLAN §8) / actual ≈ 1 h 50 min (22:10 → 23:58, build + review), Wave 0 wait ≈ 45 min used for pre-Wave-0 tools and loop runtime.
- Paid tokens: 4 Claude workflows (22 subagents, ≈2.4 M subagent tokens) + 1 read-only research agent. Local lane: not used.

---

# Wave 2 (2026-09-27, per signals/WAVE2.md)

Branch `v2-g3` now also contains `v2-w2-contracts` (7c8e087) and `v2-g1` (G1 Wave 2), merged on the coordinator's instruction. Code SHA `1552427`; final SHA in `signals/G3_DONE`.

## Gate (run on the bytes of 1552427)
Command: `npm run lint && npx tsc --noEmit && npm test && npm run build && npm run check-bundle && PORT=3103 npx playwright test e2e/workout-*.spec.ts e2e/program-rotation.spec.ts e2e/progression.spec.ts e2e/pr.spec.ts e2e/tools.spec.ts e2e/slice.spec.ts --project=chromium --workers=4`
```
✖ 53 problems (0 errors, 53 warnings)          # none in G3 paths
tsc: exit 0
 Test Files  125 passed (125)
      Tests  1058 passed (1058)
ƒ  (Dynamic)  server-rendered on demand
/workout 218.7 kB, /workout/active 233.1 kB, /workout/debrief 219.2 kB gzip, catalog leak: no — check-bundle: OK
  31 passed (21.8s)
```
Store coverage: `npx vitest run src/stores --coverage --coverage.include='src/stores/**'` → `All files | 97.73 | 94.89 | 98.49 | 99.49` (stmts, branches, funcs, lines).
Compatibility with G2: scratch merge of `v2-g2` (07139b3) in a throwaway worktree — "Automatic merge went well", `vitest src/stores src/hooks src/components/workout src/components/tools` → 596 passed, `tsc` exit 0; merge aborted, worktree removed.

## Wave 2 items
| # | Item | Status | Proof |
|---|---|---|---|
| 1 | (S2) G1-03 items for G3 (decimal comma, profile-scoped draft, rest-day dead end, others) | done (Wave 1) | Wave 1 table above; `e2e/workout-foreign-draft.spec.ts`, `program-rotation.spec.ts` "a rest session is completed…", `wave0-followup-ui.test.tsx` "stores 62,5 as 62.5 kg" |
| 2 | Time sets (duration input + hold timer, RIR optional) | done | `workout-wave2.spec.ts` "time set: typed 45 s and a 30 s hold are saved as durations with no kg volume", "a finished 45 s hold comes back as the placeholder only"; measure from catalog (92 tagged, 0 heuristic mismatches) |
| 3 | Machine setup at workout time + quick-edit sheet | done, read-only on this branch | writer detected as G2's `notes.getSetup`/`notes.setSetup`; on this branch `workout-wave2.spec.ts` "machine setup: … read-only with a notice"; after the G2 merge saving is live (scratch-merge unit tests green) |
| 4 | Order by station | done | G1's `orderByStation` from `@/lib/workout/order-by-station` (adapter deleted); `workout-wave2.spec.ts` "order by station puts the Smith exercise before the leg curl and survives a reload" |
| 5 | G4-25 Repeat workout (`startFromLog`) | done (store + hook) | `startFromLog(profileId, log, measureOf?) → WorkoutDraft \| null` (null over an existing draft); drops programId so a repeat never advances rotation (differs from G4-25's proposal on purpose); unit tests `workout-store-w2.test.ts`, `workout-orchestrator-w2.test.ts`. The button is G4's. |
| 6 | 1RM tool warning above 12 reps | done | `tools.spec.ts` "1RM calculator warns above 12 reps and still shows the estimate" (100×15 → 163.5 + warning; 100×5 → 112.5, none); uses G1 `E1RM_MAX_REPS` |
| 7 | 360 px set-row clipping | done | measured before: set-kg 48.66 wide, scrollWidth 66 > clientWidth 47 (clipped); after: 63.53 / 62 / 62; all 30 controls ≥44×44; `documentElement.scrollWidth` 360 — `workout-wave2.spec.ts` "360 px phone" (2 tests) |
| 8 | i18n for new strings | done | strings tables + parity tests; keys under "Wave 2" in `docs/v2/requests/G3-i18n.md` |
| — | G1 follow-ups (use-pr mirrors detectPRs, selectors skip time sets, holdSeconds, ghostDurationSeconds placeholder, availableKg) | done | commit 7669a4e; `livePRCheck` 12/13-rep and time-set tests; debrief `debrief-hold` |
| — | G4-02 `page-heading-workout` | done | `start-page.test.tsx`, `tool-pages.test.tsx` |

## Hardening (2 local DSH/Qwen refuters, engine queue 0 at start, one live at a time)
- **Refuter 1** (Wave 1 stores at a102e43): 10 findings, **10 reproduced with failing tests, 10 fixed** (commit a64dc42): cross-tab draft clobber (storage/visibility rehydrate), station filter hid all TYTAX exercises, warm-up ticks counted as logged work in swap, lax all-or-nothing draft validation (now strict + sanitising), 0 kg done sets, kettlebell prefill ignoring owned bells, weak point never firing (fallback ≥60 impact), deload dropping done sets, two warm-up bases (now heaviest working kg), persisted timer `totalS 0`. Failing output before: `scratchpad/hardening-before.txt`.
- **Refuter 2** (Wave 2 at dc5b5d1): 10 findings; 8 fixed with failing-first tests (13 failed / 3 passed on 7669a4e), 1 routed (history rendering, G4), 1 dropped (`stationRank` no longer exists — `grep` finds no definition in src). Key fixes: last hold only as a placeholder, never logged unless adopted; a revived or stale hold can't overwrite a typed value (30 min cap, keys cleared on remove/discard); done-ness from the set, not the exercise measure; time-aware repeat. Commit 3a46f2e.

## Requests made in Wave 2
- `G3-W2-01.md` (G2): notes setup writer — G2 has implemented `getSetup`/`setSetup`; nothing further needed beyond the merge.
- `G3-W2-02.md` (G5, FYI G1/G2): integration notes for the hardening (e2e-hooks' looser `isWorkoutDraft`; seeds need ISO `startedAt`).
- `G3-W2-03.md` (G4 + G5, S2): History must render time sets as m:ss (today `0 kg × 0 reps`); `SeedSetInput.durationSeconds` for e2e seeds.

## Unfixed findings (Wave 2)
- **What:** History shows a finished hold as `0 kg × 0 reps`. **Evidence:** refuter 2 finding 3 (`scratchpad/dsh-refuter-2-full.md`). **Why not fixed:** History is G4's. **Proposed fix:** G3-W2-03.
- **What:** Repeat with no draft has no catalog loaded, so an old hold logged as reps repeats with reps. **Evidence:** h2 verify note; `draft-ops.ts` falls back to the set check without `measureOf`. **Why not fixed:** needs `repeatLog` to load the catalog asynchronously — an API change for G4's button, too late for 03:30. **Proposed fix:** make `useWorkout().repeatLog` async and await `catalog.loadCatalog()` before `startFromLog`.
- **What:** machine setup is read-only until `v2-g2` is merged. **Why:** G2-owned writer. **Proposed fix:** merge at integration; flip `workout-wave2.spec.ts` setup test to edit → reload → shown (noted in G3-W2-01).
- **What:** the kg input at 360 px has 0 px spare with "102.5". **Evidence:** 62/62 scrollWidth/clientWidth. **Why not fixed:** within spec; a 6-character value or fallback font could clip. **Proposed fix:** G4 a11y pass or `text-[15px]` on phones.
- Mobile Playwright project not run by G3 (chromium only).
