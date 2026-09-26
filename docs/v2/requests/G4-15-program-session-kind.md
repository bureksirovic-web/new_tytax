# G4-15: optional `ProgramSession.kind`

- **Requester:** G4 (programs screen) · **Target:** frozen `src/contracts/domain.ts` (contract owner G1)
- **What:** add an optional field to `ProgramSession`:
  ```ts
  /** Training focus of the session; drives the slot editor's smart filter. */
  kind?: 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';
  ```
  Presets (`src/data/*/presets.ts`) may set it; the builder will write it for every generated day.
- **Why:** the slot editor's smart context filter (legacy L4455-4565) needs the session type. Legacy parsed it from the display name (bug B9: renaming or Croatian names like "Gornji A" silently disabled it). The split + position fallback breaks as soon as the user reorders days.
- **Local workaround (in place):** `src/components/programs/lib/slot-filter.ts` `sessionKind()` reads `session.kind` if present (typed via a local intersection, nothing written), else en/hr keywords in the name (push/potisak, pull/povlačenje, legs/noge, upper/gornji, lower/donji, full/cijelo), else split + index among training days. Once granted, the builder sets `kind` in `lib/builder.ts` (one line) and the name parsing becomes a fallback for old rows only.
