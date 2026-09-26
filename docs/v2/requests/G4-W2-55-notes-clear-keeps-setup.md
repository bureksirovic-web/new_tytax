# G4-W2-55: `notes.set(p, e, '')` must keep the row when a machine setup is on it

- **Requester:** G4 (exercise detail, `/exercises/[id]` notes + machine setup)
- **Target:** G2 `src/lib/db/repo/records.ts` (`createNotesRepo().set`, lines ~134-137 at the time of writing); G5 sync check
- **Severity:** S3 today, S1 once `setSetup` (G4-W2-20) lands and users actually save setups.
- **What is wrong:** `set(profileId, exerciseId, content)` with `content.trim() === ''` soft-deletes the whole live `exerciseNotes` row and queues an `exercise_notes` **delete**. `setup` (`contracts/domain.ts` `ExerciseNote.setup`) lives on that same row, so clearing the note text also deletes the machine setup, locally and remotely.
- **Evidence:** refuter2 finding 8 (reproduced by its lane: save setup `seat=4`, note "elbows in", clear the note → `repo.notes.get()` is `undefined`, outbox holds a remote delete). G4 test `src/app/(app)/exercises/_components/__tests__/w2-hardening.test.tsx` → "clears only after the user confirms" shows the row disappears (`notes.get` → `undefined`) with `setup: { seat: '4' }` on it.
- **Requested semantics:**
  1. `set(p, e, '')` on a live row **with** a non-empty `setup`: keep the row, set `content: ''`, bump `updatedAt`, queue an `exercise_notes` **upsert** (not delete). Return the row.
  2. `set(p, e, '')` on a live row **without** a setup: unchanged (soft-delete + queued delete, returns `undefined`).
  3. Mirror in `setSetup(p, e, null)` (G4-W2-20 item 5): soft-delete only when content is also empty.
  4. Test in G2's suite: set setup → set note → `set(p, e, '')` → `get(p, e)` deep-equals `{ content: '', setup: {...} }`, outbox last op is an upsert.
- **What G4 did meanwhile (no data hacks):** `exercise-notes.tsx` asks before saving an empty note when the stored row carries a setup: dialog "Clear the note?" / "Clearing the note also clears the saved setup." (`ex_notes_clear_*`, hr+en). Cancel keeps both; confirm calls `notes.set(p, e, '')` as today.
- **After this lands:** G4 removes the confirmation (the `losesSetup` branch in `exercise-notes.tsx`) and flips the "clears only after the user confirms" test to assert the setup survives. Integration switch: none, the dialog is merely redundant until then.
