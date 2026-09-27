import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { loadCatalog } from '@/lib/catalog';
import {
  installRepo,
  renderWithProviders,
  type Holder,
} from '@/components/settings/__tests__/settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { default: SettingsPage } = await import('../page-client');

describe('SettingsPage', () => {
  it('renders every section for the active profile, in the stored language', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Operator One');
    await repo.profiles.create({ name: 'Family Two' });
    window.localStorage.setItem('locale', 'hr');
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId('page-heading-settings')).toHaveTextContent('Postavke');
    expect(await screen.findByText('Family Two')).toBeInTheDocument();
    for (const id of [
      'settings-profiles',
      'settings-profile-edit',
      'settings-language-units',
      'settings-training',
      'settings-appearance',
      'settings-equipment',
      'settings-data',
      'settings-sync-slot',
      'settings-danger',
      'settings-manual',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId(`settings-profile-row-${me.id}`)).toHaveTextContent('Trenutni');
    expect(screen.getByTestId('settings-units-select')).toHaveValue('kg');
    expect(screen.getByTestId('settings-language-select')).toHaveValue('hr');
    // defaults: 90 s rest = 1:30, 20 kg bar
    expect(screen.getByTestId('settings-rest')).toHaveTextContent('1:30');
    expect(screen.getByTestId('settings-bar-weight')).toHaveValue('20');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows only the "sync is off" note in the sync slot when sync is disabled', async () => {
    const repo = installRepo(holder);
    await repo.profiles.ensureActive('Solo');
    renderWithProviders(<SettingsPage />);
    const slot = await screen.findByTestId('settings-sync-slot');
    expect(within(slot).getByText('Sync is off. Your data stays on this device.')).toBeInTheDocument();
    expect(within(slot).queryByRole('button')).toBeNull();
  });

  it('does not spin forever without a profile', async () => {
    installRepo(holder);
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('No profile yet')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading...' })).toBeNull());
    expect(screen.getByTestId('page-heading-settings')).toHaveTextContent('Settings');
  });

  it('has no serious or critical axe violations', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Ana');
    await repo.profiles.create({ name: 'Ivo' });
    await repo.profiles.update(me.id, { bodyweightKg: 80 });
    const { container } = renderWithProviders(
      <main>
        <SettingsPage />
      </main>,
    );
    await screen.findByText('Ivo');
    // wait for the lazy catalog's attachment list (ids differ between catalog builds)
    const [firstAttachment] = (await loadCatalog(['tytax'])).attachments;
    await screen.findByTestId(`settings-attachment-${firstAttachment.id}`);
    // colour contrast needs a real layout engine (checked in e2e)
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    const serious = res.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
    expect(res.passes.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(9);
  });
});
