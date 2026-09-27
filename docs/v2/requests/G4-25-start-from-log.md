# G4-25: `startFromLog(logId)` in the workout store (Repeat workout)

- **Requester:** G4 (history screen, `src/components/history/**`)
- **Owner of target file:** G3 (`src/stores/workout-store.ts`)
- **What:** a store action that starts a new draft from a finished log:
  ```ts
  /** New draft copying the log's exercises and set count (fresh uids/set ids, done:false,
   *  kg/reps as ghost prefill), programId/programSessionId/sessionName kept. Refuses (returns null)
   *  when a draft is already in progress. */
  startFromLog(profileId: string, log: WorkoutLog): WorkoutDraft | null;
  ```
- **Why:** spec G4 §3.2 item 6 (H9): "Repeat workout" must never start an empty workout. `WorkoutActions` today has only `startQuick` and `startFromProgram` (checked 2026-09-26), so the history detail cannot offer the button without writing the draft itself, which would bypass the store's persistence and hydration rules.
- **Proposed change:** add the action above next to `startFromProgram`; copy `SessionExercise` with `uid: crypto.randomUUID()`, and each set as `{ id: crypto.randomUUID(), type, kg, reps, done: false, ghostKg: kg, ghostReps: reps }`, dropping `isPR/e1rm/completedAt`.
- **G4 wiring once it lands** (`src/components/history/history-detail.tsx`): a "Ponovi trening" (`hist_repeat`, key to be added to the history module) button that calls `startFromLog(profileId, log)` and `router.push('/workout')`; disabled with an explanation when a draft is active.
- **Local workaround now:** the button is omitted (no dead action, no empty-workout start).
