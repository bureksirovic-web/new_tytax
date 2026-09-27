# G4-47: `repo.logs.update` still leaves `prCount` / PR records stale after an edit (follow-up to G4-26)

- **Requester:** G4 (history editor `/history/[id]/edit`), refuter round 4 finding, reproduced.
- **Owner of target file:** G2 (`src/lib/db/repo/logs.ts`)
- **Status:** G4-26 is not implemented in the integrated tree. There, `prCount` is in `SERVER_OWNED`
  (stripped from the patch), and `update` recomputes only `computeTotals`. So the editor cannot
  correct it, and the repo does not correct it either.
- **Repro (test):** `src/components/history/__tests__/refuter-round4.test.tsx`
  "editing the PR set away recomputes prCount". A log with one `isPR` set and `prCount: 1` is edited
  from 100x5 to 60x5 through `toPatch`, then `logs.update`. The saved set has no `isPR`, but
  `prCount` is still 1 (`AssertionError: expected 1 to be +0`). The test is `it.fails` until this lands.
- **User impact:** the history card shows "PRs: 1", the detail PR tile shows 1, and the dashboard
  Last workout shows "1 PR" for a record that no longer exists. The 100 kg PR record stays
  the best to beat.
- **Proposed change:** as in G4-26. Inside `update`, when `clean.exercises !== undefined`: recompute
  set `e1rm`/`isPR` with the finish rules, soft-delete this log's `prRecords`, re-detect PRs against
  the profile's other logs, then set `prCount` = the number of `isPR` sets and queue sync ops. The
  minimum fix is `prCount = count(isPR)` next to `computeTotals`.
- **After the fix:** change `it.fails` to `it` in the test above.

Repro test (fails today): `docs/v2/requests/repro/G4-47-prcount-after-edit.repro.test.tsx.txt`.
