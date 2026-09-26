# G4-41: `training.e1rm` blows up near 36 reps (Brzycki pole)

- **Requester:** G4 (analytics Best lifts, pinned e1RM, exercise inspector; history detail e1RM column)
- **Owner of target file:** G1 (`src/lib/training/e1rm.ts`); spec line GOALS.md G1 §5 "e1rm: Brzycki; Epley at 37+ reps".
- **What:** `kg × 36 / (37 − reps)` has a pole at 37 reps. Measured on the g4 tree (vitest, 2026-09-27):
  `e1rm(24, 35) = 432`, `e1rm(24, 36) = 864`, `e1rm(24, 37) = 53.6`.
  A 24 kg kettlebell swing set of 35 reps becomes the user's "best lift" (`bestLifts` ranked it 432 kg above a 100×5 bench at 112.5 kg), and the same 432 kg shows in pinned e1RM and in the history detail e1RM column.
- **Why:** high-rep KB/bodyweight sets are normal in this app (swings, snatches, conditioning), so the spike hits real users, not a corner case. The function is also discontinuous by ~16× between 36 and 37 reps.
- **Proposed change (pick one, amend the spec line accordingly):**
  1. Brzycki up to 10 reps, Epley `kg × (1 + reps/30)` above 10 (continuous enough; Epley at 10 = 1.333×, Brzycki at 10 = 1.333×), or
  2. keep Brzycki ≤ 12 and return 0 (no estimate) above 12–15 reps, so such sets never compete for e1RM.
  Option 1 keeps every existing deterministic fixture (100×5 → 112.5) unchanged.
- **Why not fixed in G4:** e1RM is training math, only through `src/lib/training` (project rule); a local cap in analytics would disagree with the history e1RM column and PR detection.
- **Local workaround now (G4):** none; analytics shows whatever `training.e1rm` returns.

- **Status (2026-09-27, G4 Wave 2):** resolved by G1 option 2 (`E1RM_MAX_REPS` = 12, `rankableE1rm(set)` in `@/lib/training`; `e1rm()` unchanged). G4 adopted it through `src/components/analytics/g1-adapters.ts` (`rankableE1rmG1`, `isTimeSetG1`, `e1rmMaxReps`: G1 export when present, identical local rule otherwise) in analytics best lifts / pinned / exercise progress, the exercise-detail e1RM stats and chart, the dashboard pinned card, the history e1RM column (a stored `set.e1rm` never overrides the cap) and the history editor (no stored e1RM above the cap). Sets above 12 reps still count for top set and volume and are shown without an e1RM (`ana_e1rm_none`). e1RM values are now rounded to 0.01 kg as in G1. Parity of the local rule with G1's real export passed on a G1+G4 overlay tree.
