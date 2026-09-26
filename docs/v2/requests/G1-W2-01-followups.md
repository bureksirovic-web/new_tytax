# G1-W2-01 — Wave 2 follow-ups in other goals' files (G1 does not edit them)

G1 Wave 2 landed on `v2-g1`: time-measured sets, `rankableE1rm`, FRAME/FREE_WEIGHT stations, `orderByStation`,
program helpers, video links. These call sites should adopt it (each is small; G5 may apply them at integration).

## G2 (persistence)
- `src/lib/db/repo/finish.ts`: store `set.e1rm = rankableE1rm(set)` (undefined above 12 reps and for time sets)
  instead of `training.e1rm(kg, reps)` for every set (their Wave 2 item 3; `E1RM_MAX_REPS` is exported now, no local 12 needed).
- `src/lib/db/repo/logs.ts` `computeTotals`: skip time sets (`isTimeSet` from `@/lib/training`) in kg volume; they still
  count in `totalSets` (their Wave 2 item 4).

## G3 (workout loop)
- `src/hooks/use-pr.ts`: the live PR flash should mirror `detectPRs`: no candidate from time sets, e1RM only through
  `rankableE1rm`.
- `src/stores/workout-selectors.ts` (`exerciseVolumeKg`, `summarizeDraft`): skip time sets in kg volume.
- "Order by station": `orderByStation(exercises, catalog)` from `@/lib/workout/order-by-station`; the result keeps
  superset blocks whole and never increases `stationChanges` (if ranking would, the input order is returned).
- Time exercises: `Exercise.measure === 'time'`; show `holdSeconds(sets)` from `@/lib/training` as the hold total.

## G4 (screens)
- Station filter: `catalog.stations` now has 7 entries (FRAME and FREE_WEIGHT are app-level; `notes` says so).
  i18n keys `station_FRAME`, `station_FREE_WEIGHT` in `G1-i18n.md`.
- `src/components/programs/lib/{load,slot-filter,rotation,slot-equipment}.ts` have G1 equivalents in
  `@/lib/programs/{load,session-kind,calendar,equipment}` (same behaviour, same tests): swap imports, delete the copies.
- `src/app/(app)/exercises/_components/video-links.ts` → `buildVideoLinks` / `primaryVideoLink` from `@/lib/catalog`
  (i18n-free: map `kind`/`n` to the existing `ex_video_*` keys).
- Kinetic impact (if ever shown): `explanationKey` (`ki_*`, rows in `G1-i18n.md`) instead of the English `explanation`.

## Contract gap (coordinator / contract owner)
- Prefill cannot hint last session's hold duration: there is no `SetEntry.ghostDurationSeconds`. Proposed additive
  optional field; `prefillFromHistory` would fill it from the matching time set.
