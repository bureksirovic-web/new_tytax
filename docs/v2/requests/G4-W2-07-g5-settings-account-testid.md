# G4-W2-07: G5's settings tests wait for a removed test id (owner: G5)

- **What:** `src/components/providers/__tests__/settings-flag-off.test.tsx` uses `findByTestId('settings-account')`. In the Wave 1 G5 branch, `src/app/(app)/settings/__tests__/page-client.test.tsx` does too. G4 replaced the old `AccountSection` with the documented mount point `SyncSlot` (`data-testid="settings-sync-slot"`). With the flag off, that slot renders only the "sync disabled" text and loads no Supabase code.
- **Evidence:** in a merged tree (v2-g4 + v2-g2 + v2-g3 + v2-g5, 2026-09-27 01:45), the test failed with `TestingLibraryElementError … settings-account`. After changing that one line to `settings-sync-slot`, it passed 1/1, and `probe.calls` stayed `[]` (no `/auth/v1` call).
- **Change:** replace `'settings-account'` with `'settings-sync-slot'` in both G5 tests. G4's `page-client.test.tsx` wins at integration because G4 owns that path.
