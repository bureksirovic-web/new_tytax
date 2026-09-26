import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));
// Sync UI is covered by its own hook tests; here it only has to render.
vi.mock('@/components/sync/sync-status', () => ({ SyncStatus: () => null }));

const { default: SettingsPage } = await import('../page-client');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`settings-page-${n}`) });
  holder.repo = repo;
  return repo;
}

describe('SettingsPage', () => {
  it('renders every section for the active profile from the repository', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Operator One');
    await repo.profiles.create({ name: 'Family Two' });
    render(<SettingsPage />);

    expect(await screen.findByDisplayValue('Operator One')).toBeInTheDocument();
    expect(await screen.findByText('Family Two')).toBeInTheDocument();
    for (const id of ['settings-profile', 'settings-units', 'settings-language', 'settings-theme', 'settings-training', 'settings-family', 'settings-account', 'settings-data']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    // The default profile settings: 90 s rest, 20 kg bar
    expect(screen.getByLabelText('workout_rest_timer')).toHaveValue('90');
    expect(screen.getByLabelText('workout_weight_kg')).toHaveValue('20');
    await waitFor(() => expect(screen.getByLabelText('units_metric')).toBeChecked());
    expect(me.settings.units).toBe('kg');
  });
});
