# G4-W2-16: the repo stores an e1RM (and can mark isPR) on time-measured sets

- **Requester:** G4 (history editor). **Owner:** G2 (`src/lib/db/repo/prs.ts`, `annotate`), with G1's time-set rule (Wave 2 G1 item 1).
- **What:** in the merged scratch tree (v2-g4 + current v2-g2), `annotate()` sets `set.e1rm = training.e1rm(s.kg, s.reps)`
  on every counting set, including sets with `durationSeconds`. Contract (`SetEntry.durationSeconds`): time sets are
  "Excluded from e1RM and kg volume".
- **Evidence:** `src/components/history/__tests__/time-sets.test.tsx` (G4), editor saves a Plank log whose time sets are sent
  **without** `e1rm` (`toPatch`, unit-tested in `duration.test.ts`); after `logs.update`, reading the log back in the scratch
  tree gives a defined `e1rm` on those sets (the assertion `sets.every(s => s.e1rm === undefined)` failed there and passes on
  v2-g4). A weighted carry (20 kg × 1 for 30 s) would get e1RM 20 kg and can become a weight/e1RM PR.
- **Why not fixed by G4:** `src/lib/db/**` is G2's.
- **Proposed fix:** in `annotate` (and PR candidate detection) skip sets where `typeof s.durationSeconds === 'number'`
  (use G1's helper once it lands), and leave `e1rm`/`isPR` unset for them. Test: a log with one kg set and one time set;
  after `finishWorkout` and after `logs.update`, only the kg set has `e1rm`, and no PR row points at the time set.
