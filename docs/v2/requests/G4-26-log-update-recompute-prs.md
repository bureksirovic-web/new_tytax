# G4-26: `repo.logs.update` recomputes set e1RM, PR flags, `prCount` and PR records

- **Requester:** G4 (history editor `/history/[id]/edit`)
- **Owner of target file:** G2 (`src/lib/db/repo/logs.ts`)
- **What:** when a patch contains `exercises`, `logs.update` today recomputes only `totalVolumeKg`, `totalSets`, `modalitiesUsed` (`computeTotals`). It leaves `set.e1rm`, `set.isPR`, `log.prCount` and the `prRecords` rows of the touched exercises as they were at finish.
- **Why:** spec G4 §3.2 editor: "the repo (not the UI) recomputes `totalVolumeKg`, `totalSets`, set `e1rm`, `isPR`, `prCount` with the same rules as `finishWorkout` and recomputes PR records for the touched exercises". Editing 100×5 down to 60×5 today leaves a PR record (and the PR star) that no longer exists in the data; removing a set that held the PR keeps the PR alive.
- **Proposed change:** inside the same `ctx.write` transaction in `update`, when `clean.exercises !== undefined`:
  1. set `e1rm = training.e1rm(kg, reps)` on done working sets, clear it elsewhere;
  2. soft-delete the `prRecords` whose `workoutLogId === id`, then re-run the finish PR detection (`training.detectPRs`) for this log against bests from the profile's other non-deleted logs, writing new records (baseline rules unchanged) and setting `isPR` / `prCount`;
  3. queue the sync ops like `finishWorkout`.
- **Local workaround now (G4):** `edit-model.ts` `toPatch` sets `e1rm` via `training.e1rm` for done working sets whose kg/reps changed and drops `isPR` on sets whose load/reps/type/done changed. `prCount` and PR records stay stale until this lands.
