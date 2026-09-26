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

- **Status (2026-09-27, G4 Wave 2):** G1 shipped the ports in `@/lib/programs/{load,session-kind,equipment,calendar}` (v2-g1). Not adopted at runtime on v2-g4: those modules do not exist on this branch, and a static import of a missing module breaks `tsc`/`next build` (no runtime namespace read is possible for a whole module). The local copies stay; `src/components/programs/lib/__tests__/g1-parity.test.ts` (via `import.meta.glob`) checks them against G1's `liveLoadByGroup`, `projectedFocus`, `pushPullRatio`, `sessionKind`, `hiddenMuscleChips`, `sessionContextAllows`, `rotationIndexForDate` wherever those modules exist, and passed on a G1+G4 overlay tree. **At integration (G5):** swap the imports in `components/programs/**` to `@/lib/programs/*` (renames: liveLoad→liveLoadByGroup, focusGroup→projectedFocus, pushPull→pushPullRatio, hiddenChips→hiddenMuscleChips, contextAllows→sessionContextAllows) and delete the duplicated functions from `lib/{load,slot-filter,rotation,slot-equipment}.ts`.
