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
- **Local workaround (in place now):** `src/components/analytics/use-analytics-data.ts` (`readPins` / `savePins`) reads and writes the key through `repo.profiles.updateSettings(profileId, { pinnedExerciseIds } as Partial<ProfileSettings & { pinnedExerciseIds?: string[] }>)`. The repository's `mergeSettings` keeps unknown keys and `validateSettings` ignores them, so this persists per profile today (covered by `src/components/analytics/__tests__/use-analytics-data.test.ts` "pinned exercises"). `readPins` defends against non-array / non-string values and caps at 4.
- **After the field lands:** drop the `SettingsWithPins` cast in `use-analytics-data.ts`; no data migration needed.
- **G5 check:** if the Supabase `profiles.settings` column is typed/whitelisted rather than jsonb pass-through, add the key there, or pins will not sync (they still persist locally).
