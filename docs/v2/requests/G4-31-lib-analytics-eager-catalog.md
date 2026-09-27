# G4-31: `src/lib/analytics/volume-parity.ts` imports the eager catalog (`@/data`)

- **Requester:** G4 (analytics screen)
- **Target:** G1 (`src/lib/analytics/**`)
- **What:** `volume-parity.ts` does `import { findExerciseById } from '@/data'` as a default lookup; `kinetic-impact.ts` builds on it. Any UI that imports either module pulls the whole exercise catalog into its chunk, bypassing the lazy catalog (CLAUDE.md rule, AC8 bundle budget).
- **Why it matters now:** Wave 0's analytics page imported these; the v2 analytics screen no longer does (its movement balance lives in `src/components/analytics/exercise-series.ts` over `training` + the lazy catalog lookup), so nothing in the analytics UI imports `@/lib/analytics/**` any more.
- **Proposed change:** make `lookup` a required parameter of `computeVolumeParity` / `computeKineticImpact` and remove the `@/data` import; or delete `src/lib/analytics/**` if no other screen uses it (check dashboard). Also `kinetic-impact.ts` returns English `explanation` strings (spec N5); if kept it should return codes.
- **Local workaround:** none needed on the analytics screen.
