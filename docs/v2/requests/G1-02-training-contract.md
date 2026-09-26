# G1-02 — training contract: additive field + clarified semantics (after Wave 0)

Owner: G1 (training engine). Status: applied on branch `v2-g1`; no other goal needs to change code.

## Additive optional field
- `PrefillOptions.availableKg?: readonly number[]` (src/contracts/training.ts). Weights that exist for the exercise
  (e.g. `EquipmentInventory.kettlebellsKg`). With it, prefill snaps up to the next real bell. G3 may pass it when
  starting a kettlebell workout; without it kettlebells hold their weight.

## Semantics clarified (doc comments only; behaviour fixes from the Wave 0 review)
- Prefill reads only done sets of type `working` (a finishing drop/failure set no longer blocks progression).
- Bodyweight sets (0 kg) never get +2.5 kg; they progress on ghost reps.
- `detectPRs`: e1RM PRs only from sets of ≤ 12 reps (Brzycki diverges near 37 reps: 16 kg × 35 → 288 kg);
  new `reps` PRs for sets at 0 kg (bodyweight), using the existing `PRType` `'reps'`.
- ACWR chronic load = mean weekly load over the weeks of history actually available (1–4), so a new user's
  first session is ratio 1 (`recovering`), not 4 (`fried`).

## Follow-ups for other owners
- G3 `src/hooks/use-pr.ts`: if it shows a live "PR" flash, mirror the ≤ 12-reps rule for e1RM.
- G2 `src/lib/db/repo/finish.ts`: the new `reps` candidates are ordinary `PRCandidate`s; they are written as `PRRecord`s
  like the others (no change needed unless the UI filters by type).
