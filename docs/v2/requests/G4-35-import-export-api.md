# G4-35 — Settings needs G2's import/export entry points

**From:** G4 (settings) · **To:** G2 (`src/lib/import`, `src/lib/export`) · **Date:** 2026-09-26

## What
Settings calls G2's libraries through one adapter, `src/components/settings/export-adapter.ts`
(dynamic import, so nothing lands in the settings first-load chunk). In branch v2-g4 today:

| Need | Status in v2-g4 | Used by |
|---|---|---|
| `workoutLogsToCSV(logs: WorkoutLog[]): string` in `@/lib/export/csv` | exists (old version) | "Workouts (CSV)" button — works |
| `bodyweightToCSV(entries: BodyweightEntry[]): string` in `@/lib/export/csv` | **missing** | "Bodyweight (CSV)" button — rendered disabled with "Not available yet" |
| `@/lib/import` legacy service (`previewLegacyImport`, `importLegacy`) | **absent in v2-g4; built on v2-g2** | "Import from the old TYTAX app": full UI done in v2-g4 against a local mirror; disabled until the adapter is switched (below) |

## Exact proposed change
1. Export `bodyweightToCSV(entries: BodyweightEntry[]): string` from `src/lib/export/csv.ts`
   (header in kg, soft-deleted rows excluded, formula-injection-safe cells). The adapter picks it up by
   name automatically; no settings change needed.
2. ~~Ship `parseLegacy`/`commitLegacyImport`~~ superseded: G2 shipped `previewLegacyImport(input, { resolver? })`
   and `importLegacy(repo, input, { users: [{ username, target: { profileId } | { createProfileName } }] })`
   from `@/lib/import` (service/index.ts). Settings uses them as they are; see "Apply at integration" below.
3. `downloadCSV` in `csv.ts` revokes the object URL synchronously (spec §6.4); settings does not use it
   (it has its own deferred-revoke `downloadText`), but other callers should get the fix.

## Why
Spec G4-spec-settings §6.3/§6.4; GOALS G4 settings: legacy import + CSV export. A static import of a
module that does not exist breaks `tsc` and the build, hence the adapter.

## Local workaround (in place)
JSON backup/restore uses the frozen `repo.exportBackup` / `repo.importBackup` directly, with a local
validator (`backup-io.ts`: size cap, JSON, `__proto__`/`constructor`/`prototype` rejection,
format/version, per-table row checks) and a preview with counts before any write. CSV bodyweight and legacy
import are disabled controls with `set_feature_pending` as their accessible description.

## Update 2026-09-26: G2's legacy API is known; settings UI is done in v2-g4

G4 built the whole legacy-import flow in v2-g4 against a structural mirror of G2's service types
(`src/components/settings/legacy-import-api.ts`: `LegacyImportApi { preview, run }`, preview/result shapes,
`LEGACY_MAX_BYTES` = G2 `DEFAULT_MAX_BYTES` 20 MiB, error code → i18n key map for `ImportError` and
`RepoError` codes). Files: `legacy-import.tsx` (file picker, busy, errors), `legacy-import-dialog.tsx`
(preview + per-user target: new profile named after the user (default, renamable) / existing profile / skip;
confirm; result), `legacy-user-row.tsx`, `legacy-import-result.tsx` (`role="status"` summary),
`legacy-import-model.ts` (choices → `importLegacy` options, name/duplicate checks), strings `set_legacy_*` in
`src/lib/i18n/modules/settings.ts` (hr + en). Unit tests with a fake API: `__tests__/legacy-import.test.tsx`,
`__tests__/legacy-import-model.test.ts`. In v2-g4 `loadLegacyImportApi()` still returns `null`, so the
control is disabled with `set_feature_pending`.

The mirror makes `unresolvedCount` optional (the UI falls back to `unresolved.length`), so it works with G2
revisions before and after `service/cap.ts`.

### Apply at integration (G5, verbatim)

1. In `src/components/settings/export-adapter.ts` replace the whole `loadLegacyImportApi` function
   (doc comment included) with:

```ts
/**
 * Legacy (tytax-autonomous) import through G2's service (`@/lib/import`),
 * loaded on demand. The assignment to `LegacyImportApi` makes tsc check that
 * G2's signatures still match the settings mirror (legacy-import-api.ts).
 */
export async function loadLegacyImportApi(): Promise<LegacyImportApi | null> {
  try {
    const mod = await import('@/lib/import');
    const api: LegacyImportApi = { preview: mod.previewLegacyImport, run: mod.importLegacy };
    return api;
  } catch (error: unknown) {
    console.error('[settings] legacy import module failed to load', error);
    return null;
  }
}
```

   (the `import type { LegacyImportApi } from './legacy-import-api';` line is already in the file.) The typed
   `const api: LegacyImportApi` is the compile-time check that G2's signatures still fit the mirror.

2. Add the test file `src/components/settings/__tests__/legacy-import.integration.test.tsx`:

```tsx
/**
 * End to end through the real adapter (`loadLegacyImportApi` → `@/lib/import`),
 * G2's synthetic multi-user fixture, the real catalog resolver and a
 * fake-IndexedDB repository: pick file → preview → import into new profiles.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { MULTI_USER_DUMP } from '@/lib/import/__fixtures__/expected';
import { loadFixtureText } from '@/lib/import/__fixtures__/load';
import { installRepo, renderWithProviders, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { ExportPanel } = await import('../export-panel');

let repo: Repository;
beforeEach(() => {
  repo = installRepo(holder);
});

const fixtureFile = () =>
  new File([loadFixtureText(MULTI_USER_DUMP.file)], 'tytax_backup.json', { type: 'application/json' });

async function pickFixture() {
  const btn = screen.getByTestId('settings-legacy-import');
  await waitFor(() => expect(btn).toBeEnabled());
  fireEvent.change(screen.getByTestId('settings-legacy-input'), { target: { files: [fixtureFile()] } });
  return screen.findByTestId('settings-legacy-preview', {}, { timeout: 15_000 });
}

describe('legacy import (integration)', () => {
  it('imports every fixture user into a new profile with the expected log counts', { timeout: 30_000 }, async () => {
    const me = await repo.profiles.ensureActive('Tomi');
    renderWithProviders(<ExportPanel profile={me} />);

    const preview = await pickFixture();
    const usernames = Object.keys(MULTI_USER_DUMP.users);
    expect(usernames).toEqual(['Ana', 'Marko Horvat']);
    for (const name of usernames) {
      const row = within(preview).getByTestId(`legacy-user-${name}`);
      const exp = MULTI_USER_DUMP.users[name];
      expect(row).toHaveTextContent(`Workouts: ${exp.logs} · Sets: ${exp.sets} · Bodyweight: ${exp.bodyweight}`);
      expect(within(row).getByTestId(`legacy-target-${name}`)).toHaveValue('new');
    }
    // nothing is written before confirming
    expect((await repo.profiles.list()).map((p) => p.name)).toEqual(['Tomi']);

    fireEvent.click(within(preview).getByTestId('settings-legacy-confirm'));
    const status = await screen.findByRole('status', {}, { timeout: 15_000 });
    expect(within(status).getByText('Import finished')).toBeInTheDocument();

    const profiles = await repo.profiles.list();
    expect(profiles.map((p) => p.name).sort()).toEqual(['Ana', 'Marko Horvat', 'Tomi']);
    for (const name of usernames) {
      const profile = profiles.find((p) => p.name === name);
      expect(profile).toBeDefined();
      expect(await repo.logs.count(profile!.id)).toBe(MULTI_USER_DUMP.users[name].logs);
      expect(within(status).getByTestId(`legacy-result-${name}`)).toHaveTextContent(
        `${name} → new profile ${name}Workouts: ${MULTI_USER_DUMP.users[name].logs} added, 0 updated, 0 already there`,
      );
    }
    expect(await repo.logs.count(me.id)).toBe(0);
  });

  it('re-importing into the profiles it created adds nothing', { timeout: 30_000 }, async () => {
    const me = await repo.profiles.ensureActive('Tomi');
    const view = renderWithProviders(<ExportPanel profile={me} />);
    fireEvent.click(within(await pickFixture()).getByTestId('settings-legacy-confirm'));
    fireEvent.click(await screen.findByTestId('settings-legacy-close', {}, { timeout: 15_000 }));
    const ana = (await repo.profiles.list()).find((p) => p.name === 'Ana')!;
    const marko = (await repo.profiles.list()).find((p) => p.name === 'Marko Horvat')!;

    const preview = await pickFixture();
    fireEvent.change(within(preview).getByTestId('legacy-target-Ana'), { target: { value: `p:${ana.id}` } });
    fireEvent.change(within(preview).getByTestId('legacy-target-Marko Horvat'), { target: { value: `p:${marko.id}` } });
    fireEvent.click(within(preview).getByTestId('settings-legacy-confirm'));
    const status = await screen.findByRole('status', {}, { timeout: 15_000 });
    expect(within(status).getByTestId('legacy-result-Ana')).toHaveTextContent(
      `Ana → profile AnaWorkouts: 0 added, 0 updated, ${MULTI_USER_DUMP.users.Ana.logs} already there`,
    );
    expect(await repo.logs.count(ana.id)).toBe(MULTI_USER_DUMP.users.Ana.logs);
    expect(await repo.logs.count(marko.id)).toBe(MULTI_USER_DUMP.users['Marko Horvat'].logs);
    expect((await repo.profiles.list())).toHaveLength(3);
    view.unmount();
  });
});
```

3. Verified in the merged scratch tree (v2-g4 + G1/G2/G3/G5 branches, G2 service without `cap.ts`):
   `npx tsc --noEmit` clean; `npx vitest run src/components/settings 'src/app/(app)/settings'` 10 files /
   67 tests passed (the 2 integration tests included); eslint on `src/components/settings` and the i18n
   module: 0 problems.

4. Note for the integrator: `__tests__/data-card.test.tsx` → "shows the not-yet-available controls disabled"
   asserts the legacy button is disabled right after render. It still passes after step 1 only because the
   API loads asynchronously; once integrated, drop its two `legacy` lines (the null-API case is covered by
   `legacy-import.test.tsx`, "stays disabled with the pending note when the API is unavailable").
