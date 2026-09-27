# G4-W2-15: "Repeat workout" is wired; it appears once G3's `startFromLog` lands (follow-up to G4-25)

- **Requester:** G4 (history screen). **Owners:** G3 (`src/stores/workout-store.ts`), G5 (integration check).
- **State on 2026-09-27 ~00:30:** `startFromLog` exists neither in v2-g4 nor in v2-g3 (`/home/tomi/Projects/tytax-v2/g3/src/stores`, `src/hooks` checked), nor in the merged scratch tree. The button is therefore hidden everywhere today.
- **G4 side (done, v2-g4):** `src/components/history/repeat-workout.tsx` renders `data-testid="history-repeat"` on `/history/[id]` only when
  `typeof useWorkoutStore.getState().startFromLog === 'function'` (adapter `src/components/history/start-from-log.ts`,
  `resolveStartFromLog`). It calls `startFromLog(log.profileId, log)`, accepts a sync or async return, and on a truthy draft
  does `router.push('/workout/active')`. A falsy return shows `hist_repeat_failed` (role="alert").
  - Own-profile draft present → dialog: "Continue current" (`history-repeat-continue`, pushes `/workout/active`) or
    "Replace" (`history-repeat-replace`: `discard()` then `startFromLog`).
  - Another profile's draft present → dialog explains, no replace (never destroys another profile's workout).
- **What G3 must ship for it to appear (no G4 change needed):** the action on the zustand store state with the G4-25 signature
  ```ts
  startFromLog(profileId: string, log: WorkoutLog): WorkoutDraft | null;
  ```
- **One-line switch at integration, only if G3 ships a different name/shape** (edit `resolveStartFromLog` in
  `src/components/history/start-from-log.ts`):
  - different name, e.g. `repeatLog` with the same arguments:
    `const fn = (state as { repeatLog?: unknown }).repeatLog;`
  - `(log)` without profileId: in `repeat-workout.tsx` replace `await start(log.profileId, log)` with
    `await (start as unknown as (l: WorkoutLog) => WorkoutDraft | null)(log)`.
- **Proof at integration (G5):** `npx vitest run src/components/history/__tests__/repeat-workout.test.tsx` (uses a stand-in
  action injected with `useWorkoutStore.setState`), plus an e2e: seed a log, open `/history/<id>`, click `history-repeat`,
  expect `/workout/active` with the log's exercises.
