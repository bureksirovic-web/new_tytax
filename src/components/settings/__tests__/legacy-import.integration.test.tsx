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
