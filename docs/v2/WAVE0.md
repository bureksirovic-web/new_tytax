# Wave 0 — what landed and how to use it

Branch `v2-wave0` (SHA in `~/Projects/tytax-v2/signals/WAVE0_DONE`). Built by G1, 2026-09-26.
After `git merge v2-wave0` run `npm ci` (dependencies changed).

## Frozen contracts (`src/contracts/**`)
| File | What |
|---|---|
| `domain.ts` | Every entity: `Exercise`, `SetEntry`, `SessionExercise {uid, exerciseId, sets}`, `WorkoutDraft`, `WorkoutDebrief`, `WorkoutLog`, `Program`/`ProgramSession`/`ProgramExercise`/`ProgramTemplate`, `Profile` + `ProfileSettings` (+ `DEFAULT_PROFILE_SETTINGS`), `PRRecord`, `BodyweightEntry`, `ExerciseNote`, `ArsenalEntry`, `EquipmentInventory`, analytics value types, and `Legacy*V2` shapes for the migration. |
| `repo.ts` | `Repository` (profiles, logs, programs, prs, bodyweight, notes, arsenal, equipment, outbox, `finishWorkout`, `transaction`, `watch`, backup, `applyRemote`, `resetAll`), `RepoError` + codes. |
| `training.ts` | `TrainingApi`: `e1rm`, `generateWarmups`, `prefillFromHistory`, `detectPRs`, `impactDistribution`, `laggingMuscle`, `recoveryStatus`, `acwr`, `deload`. |
| `exercise-catalog.ts` | `CatalogApi` (`loadCatalog`, `getById`, `search`, `preloadAll`), `Catalog`, `CatalogQuery`. |
| `sync.ts` | `SyncAdapter`, `SyncOutbox`, `SyncOperation`, `SyncTable`, `noopSyncAdapter`. |
| `fixtures.ts` | Synthetic builders (`buildWorkoutLog`, `buildProfile`, `sequentialIds`, `localDay`) and the `window.__tytaxE2E` hook types. |

`src/types/**` only re-exports the contracts. Contract changes: `docs/v2/requests/G<n>-<nn>.md` (one file per request); an additive optional field is allowed after Wave 0 when recorded there.

Key rules the contracts encode:
- Weights are kg everywhere; `settings.units` only changes display (`kgToDisplay`/`displayToKg` in `src/lib/utils.ts`).
- The active program is `Profile.activeProgramId` (no boolean index). The active profile is device-level (`repo.profiles.getActiveId()`).
- Soft-deleted rows are hidden by default; pass `{ includeDeleted: true }` to see them.
- `finishWorkout(draft, debrief)` is atomic and idempotent: log id = draft id; PRs, rotation advance and sync ops happen in the same transaction. First-ever records are *baselines* (`isBaseline`): stored, never celebrated, not in `prCount`.
- Only done, non-warm-up sets count for PRs, volume, impact, recovery and ACWR.

## Runtime entry points
| Need | Use |
|---|---|
| Data (any goal) | `getRepository()` from `@/lib/db`; in React `useRepoQuery(repo => …, deps)`, `useActiveProfile()`, `useRepo()` from `@/hooks/use-repo` |
| Exercises | `catalog` from `@/lib/catalog` (lazy, chunked per modality); React: `useCatalog()` / `useExercises()` from `@/hooks/use-exercises`. Never import `@/data/**` exercise arrays from UI. |
| Training math | `training` from `@/lib/training` |
| Presets | `ALL_PRESETS`, `getPresetById(presetId)`, `DEFAULT_TYTAX_PRESET_ID` from `@/lib/programs/presets`; pure rotation helpers in `@/lib/programs/utils` |
| In-progress workout | `useWorkoutStore` + `useWorkoutHydrated()` from `@/stores/workout-store` (persisted to localStorage `tytax.workout-draft.v3`; wait for hydration before redirecting) |
| Sync | the repository takes a `SyncAdapter`; `setRepositorySyncAdapter(adapter)` from `@/lib/db`. Default is `noopSyncAdapter` (no queue, no network). |

## Test harness
- **Ports:** `PORT=310<n> npx playwright test …`. `reuseExistingServer` is false; the webServer is `next dev -p $PORT` (`E2E_SERVER=prod` → `next start`). A SHA guard checks that `/api/health` serves this worktree's `git rev-parse HEAD` — commit before running e2e if you want the guard to match a new HEAD (the server is started fresh per run, so it always matches).
- **Specs** import `test`/`expect` from `./fixtures` (lint-enforced). The fixture fails any passing test with fewer than 3 `expect` calls. The `tytax` fixture seeds data through the app: `gotoApp`, `reset`, `seedProfile`, `seedHistory`, `seedProgram`, `listLogs`, `snapshot`.
- **Lint guards:** no `if (await x.isVisible())` / `count()` guards, no `waitForTimeout`, no `.skip/.only/.fixme/.todo`. `i18next/no-literal-string` runs at `warn` on `src/**/*.tsx` and becomes `error` at integration.
- **Unit tests:** IndexedDB via `import 'fake-indexeddb/auto'`; build data with `@/contracts/fixtures`.
- `npm run test:sync` runs `src/**/*.sync.test.ts` (G5's suite; excluded from `npm test`).

## Slice proven by the gate
`e2e/slice.spec.ts`: fresh profile → quick workout → add an exercise from the lazy catalog → 3 sets (kg/reps/RIR/done) → reload (nothing lost) → finish → debrief → saved in history.

## Known gaps handed on
See the "Wave 0" section of `docs/v2/goals/G1-REPORT.md`.
