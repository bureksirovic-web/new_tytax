# G4-W2-30: analytics catalog lookup (F8) and time-measured sets, no integration switch needed

- **Requester:** G4 (analytics). **Targets:** G1 (`src/lib/analytics`, `src/lib/training`), for information and an optional cleanup. G5 (integration) has nothing to switch.
- **F8:** `src/components/analytics/muscle-volume.ts` calls `volumeByMuscle` through a structural type `(logs, opts?: { lookup })`. It always passes `{ lookup }` from the lazy catalog (`useAnalyticsData().lookup` → `MuscleDistribution`).
  - v2-g4's one-argument version ignores the options. For that version the adapter first fills a missing `muscleImpactSnapshot` from the catalog.
  - G1's version (merged scratch tree) reads the catalog impact directly.
  - Either way, program logs without a snapshot now add muscle volume. Test: `src/components/analytics/__tests__/wave2-volume.test.tsx`, which uses a real catalog entry and hand-derived 1000 kg × score / 100, and passes in both trees.
- **Not called by the screen:** `analyzeMuscleGaps` and `computeVolumeParity`. The lagging muscle comes from `training.laggingMuscle`, and movement balance from `movement-balance.ts`, both with the lookup. `computeWeeklyVolume` is not called either: the weekly chart is kg totals and needs no muscle split. So these have no call sites to change.
- **Time-measured sets:** `isKgSet` in `analytics-math.ts` is `isDoneWorkingSet(s) && typeof s.durationSeconds !== 'number'`. It drives e1RM series, best lifts, the trained-exercise list, kg volume (heatmap, weekly chart), movement balance, and the muscle kg volume. The set-based muscle share (`training.impactDistribution`) still counts holds as stimulus.
- **Optional after G1 merges:**
  - (a) Drop the snapshot filling in `prepareExercise` (`muscle-volume.ts`), because G1's `impactWeights` already prefers the catalog.
  - (b) If G1 exports a time-set predicate from `@/lib/training`, `isKgSet` can delegate to it. The behaviour is the same, so neither change is required.
