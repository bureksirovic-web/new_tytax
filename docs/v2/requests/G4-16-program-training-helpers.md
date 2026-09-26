# G4-16: program-template helpers in `@/lib/training` (or `@/lib/programs`)

- **Requester:** G4 (programs screen) · **Target:** G1 (`src/lib/training` / `src/lib/programs`, `src/contracts/training.ts` additive)
- **What:** pure helpers over catalog exercises, as specified in `docs/v2/goals/G4-spec-programs-exercises-history.md` §1.1 P9/P12/P13/P17/P18 and §5:
  - `liveLoadByGroup(exercises): {group, score, pct}[]` (10 groups, score = Σ impact × (unilateral ? 2 : 1), pct = min(100, score/300×100))
  - `projectedFocus(exercises): group | null`
  - `pushPullRatio(exercises): {push, pull, ratio, imbalanced}`
  - `sessionContextAllows(kind, exercise)`, `hiddenMuscleChips(kind)`
  - `ownsRequiredAttachment(exercise, inventory)` + an exported "required attachments of an exercise" (today only `matchesAttachment` per id exists in `@/lib/catalog/query`)
  - `rotationIndexForDate(startDate, today, n)` (calendar alignment, local dates)
- **Why:** rule "training math only via `@/lib/training`"; the dashboard/workout may want the same rotation-by-date and focus numbers.
- **Local workaround (in place, unit-tested):** `src/components/programs/lib/{load,slot-filter,rotation}.ts` implement exactly these with the legacy formulas and hand-checked tests (`lib/__tests__/*.test.ts`). When G1 ships them, swap the imports and delete the local copies.
