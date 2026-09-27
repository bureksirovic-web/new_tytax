# G4-30: additive optional `ProfileSettings.pinnedExerciseIds` (analytics pinned metrics)

- **Requester:** G4 (analytics screen)
- **Target:** `src/contracts/domain.ts` (frozen; additive optional field only), G2 `src/lib/db` (nothing required), G5 sync mapping (check only)
- **What:** add to `ProfileSettings`:

```ts
  /** Analytics "pinned lifts": up to 4 exercise ids, in display order. Absent = none pinned. */
  pinnedExerciseIds?: string[];
```

No default in `DEFAULT_PROFILE_SETTINGS` (absent means none).

- **Why:** GOALS G4 §5 "pinned metrics" must persist per profile. Legacy stored pins by free-text name with substring matching (spec bug 3.16); v2 pins by exercise id, max 4.
- **Interim storage (in place now):** G2's repository rejects unknown settings keys (`RepoError('VALIDATION')`: "settings.pinnedExerciseIds is not a known setting"), so pins must not depend on the settings key before this field lands. `src/components/analytics/use-analytics-data.ts` stores them in **localStorage**, key `tytax.analytics.pinned.<profileId>` (JSON array of exercise ids), one key per profile:
  - `savePins` always writes localStorage (SSR-safe, try/catch around storage access), then also offers `{ pinnedExerciseIds }` to `repo.profiles.updateSettings`; a `VALIDATION` rejection is swallowed, any other repository error still surfaces.
  - `readPins(settings, profileId)` / `usePinnedExercises` prefer `settings.pinnedExerciseIds` when it is an array (the future contract), else the localStorage value. Every read is validated: non-array / corrupt JSON → `[]`, non-string and empty ids dropped, deduplicated, capped at 4.
  - `usePinnedExercises` subscribes to the store (`useSyncExternalStore` + the `storage` event), so a save re-renders without a profile change.
  - Limitation: localStorage pins are per device and do not sync until the field lands.
  - Covered by `src/components/analytics/__tests__/use-analytics-data.test.ts` ("pinned exercises": per-profile isolation, remount, VALIDATION swallowed, settings array preferred, corrupt storage) and `src/app/(app)/analytics/__tests__/pages.test.tsx` (pin survives a page remount; another profile starts empty).
- **After the field lands:** drop the `SettingsWithPins` cast in `use-analytics-data.ts`. Settings then win on read; optionally copy a profile's localStorage pins into settings once (first save already does it), then remove the localStorage key.
- **G5 check:** if the Supabase `profiles.settings` column is typed/whitelisted rather than jsonb pass-through, add the key there, or pins will not sync (they still persist locally).

## Status (Wave 2, 2026-09-27): contract field landed; G4 side done, G2 side open

- **Contract:** `ProfileSettings.pinnedExerciseIds?: string[]` merged via `v2-w2-contracts` (no default). The `SettingsWithPins` cast is gone (`SettingsWithPins` is now a plain alias of `ProfileSettings`, kept for importers).
- **G4 (`src/components/analytics/pinned-storage.ts`), exported names unchanged** (`usePinnedExercises`, `readPins`, `savePins`, `readStoredPins`, `sanitizePins`, `pinsStorageKey`, `MAX_PINNED`; new `migrateStoredPins`):
  - Settings are the store. `savePins` calls `repo.profiles.updateSettings(id, { pinnedExerciseIds })`. On success the localStorage key is removed. Only a `VALIDATION` rejection (a repository that does not know the key) writes the localStorage fallback. Any other error surfaces.
  - `readPins` / `usePinnedExercises`: a settings array wins, even an empty one. Otherwise the localStorage fallback is read.
  - One-time migration: `usePinnedExercises` offers existing localStorage pins to settings once per profile and stored value. Accepted: the key is removed. Refused: the pins stay local, and the same value is never offered again in that session. When settings already hold an array, a stale local key is simply removed.
  - Tests: `src/components/analytics/__tests__/wave2-pins.test.ts` and `use-analytics-data.test.ts` ("pinned exercises"). Both pass against v2-g4's repository, which keeps the key, and against the merged scratch tree (G2 Wave 1 `SETTING_KEYS` whitelist), which rejects it and so exercises the fallback.
- **Open, G2 (WAVE2 G2 item 6):** `src/lib/db/repo/settings.ts` builds `SETTING_KEYS` from `Object.keys(DEFAULT_PROFILE_SETTINGS)`. `pinnedExerciseIds` has no default, so it is still rejected there. G2 needs to add it to the known keys and validate it (array of non-empty strings, at most 4). Until then pins stay in localStorage on that repository. No G4 change is needed when it lands: the migration moves them automatically.
- **G5 check:** unchanged from above (Supabase `profiles.settings` must pass the key through).
