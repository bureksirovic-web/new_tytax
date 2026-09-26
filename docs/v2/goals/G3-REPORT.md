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
