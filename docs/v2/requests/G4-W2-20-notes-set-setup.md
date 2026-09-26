# G4-W2-20: `NotesRepo.setSetup` for the machine-setup editor

- **Requester:** G4 (exercise detail, `/exercises/[id]` "Machine setup" editor)
- **Target:** contract owner (`src/contracts/repo.ts`, additive), G2 `src/lib/db/repo/notes.ts` (implementation), G3 (same method for the workout quick-edit sheet, WAVE2 G3 item 3), G5 (sync mapping check)
- **What:** add to `NotesRepo`:

```ts
  /**
   * Upsert the per-profile machine setup on the exercise's note. `null` (or an
   * object with no non-empty field) removes `setup`. Creates the note row with
   * `content: ''` when none is live. Returns the note row, or undefined when the
   * row was removed because both content and setup are empty.
   */
  setSetup(profileId: string, exerciseId: string, setup: MachineSetup | null): Promise<ExerciseNote | undefined>;
```

- **Semantics G4 relies on** (tested with a fake of exactly this shape in
  `src/app/(app)/exercises/_components/__tests__/machine-setup.test.tsx`):
  1. Profile-scoped: another profile's `notes.get(...)` never sees it.
  2. After `setSetup(p, e, {seat:'4', pin:'7', benchAngle:'30°'})`, `notes.get(p, e)?.setup` deep-equals that object (G4 already trims, caps each field at 40 chars and drops empty fields before calling).
  3. `setSetup(p, e, null)` → `notes.get(p, e)?.setup` is `undefined`; the note's `content` is untouched.
  4. It is a normal write: inside `ctx.write`, queues `exercise_notes` upsert, so `repo.watch` live queries refire.
  5. **Existing `notes.set(p, e, '')`** (the notes textarea saving an empty note) currently soft-deletes the row; with a live `setup` it must instead keep the row (content `''`, setup kept), or the user loses the machine setup by clearing a note. Likewise `setSetup(p, e, null)` on a row with empty content may soft-delete it.
  6. Validation: `setup` must be a plain object whose values are strings; unknown keys dropped or rejected with `RepoError('VALIDATION')`.
- **Why a method, not a 4th arg on `set`:** an optional 4th parameter cannot be detected safely at runtime (an implementation that ignores it would look like success and silently drop the setup), and `set`'s empty-string delete semantics would couple clearing a note to clearing a setup.
- **Adapter in place now (G4):** `src/app/(app)/exercises/_components/setup-adapter.ts` → `setupWriter(repo.notes)` returns a writer only when `typeof repo.notes.setSetup === 'function'`. Without it the editor shows a stored setup read-only, disables its fields and says why (`ex_setup_unavailable`). Reads use the already-typed `repo.notes.get(...)?.setup`.
- **Integration switch:** none. Once G2's implementation exposes `setSetup` on the object returned by `createNotesRepo`, the editor enables itself. If G2 names it differently (e.g. only `getSetup` + a `set` overload), the one-line change is in `setupWriter`:

```ts
  const fn = (notes as { setSetup?: unknown }).setSetup;   // ← point at G2's method name here
```

- **After the contract lands:** `setupWriter` may become `(repo.notes).setSetup` directly; keep the null-check if the method stays optional on the contract.
- **G5 check:** `exercise_notes` sync mapping must carry the `setup` column (jsonb) or setups stay device-local.
