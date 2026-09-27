# G4-17: `programs.remove` (hard) for builder drafts; optional preset `description`

- **Requester:** G4 (programs screen) · **Target:** G2 (`src/contracts/repo.ts` `ProgramsRepo`, `src/lib/db/repo/programs.ts`), G1 (`ProgramTemplate` / presets)
- **What:**
  1. `ProgramsRepo.remove(profileId, id): Promise<void>` — hard delete of a never-activated builder draft (spec §1.2 "Discard draft"), clears `activeProgramId` if it pointed there, queues a sync delete.
  2. Optional `description?: string` on `Program`/`ProgramTemplate` (or a `PRESET_DESCRIPTIONS` map keyed by `presetId` in `@/lib/programs/presets`) so the preset list can show what each protocol is.
- **Why:** discarding a draft should not leave a tombstone that syncs and counts as a user program; the preset list currently shows only name/split/frequency/modalities.
- **Local workaround (in place):** "Discard draft" calls `repo.programs.softDelete` (the row is hidden everywhere). The preset card shows split, days per week, training-day count and modalities, no description.
