import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { installRepo, renderWithProviders, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { ProfilesCard } = await import('../profiles-card');
const { useWorkoutStore } = await import('@/stores/workout-store');

let repo: Repository;
beforeEach(() => {
  repo = installRepo(holder);
  useWorkoutStore.setState({ draft: null });
});

/** G3-04: a workout draft belongs to one profile, whichever profile is active. */
describe('ProfilesCard with a workout of another profile in progress', () => {
  it('says the workout stays with its owner when switching to a third profile', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    const marko = await repo.profiles.create({ name: 'Marko' });
    useWorkoutStore.getState().startQuick(ivo.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    fireEvent.click(await screen.findByTestId(`settings-profile-switch-${marko.id}`));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A workout is in progress. It stays saved on profile Ivo.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch' }));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(marko.id));
    expect(useWorkoutStore.getState().draft?.profileId).toBe(ivo.id);
  });

  it('switches to the draft owner without a warning', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    useWorkoutStore.getState().startQuick(ivo.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);
    fireEvent.click(await screen.findByTestId(`settings-profile-switch-${ivo.id}`));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(ivo.id));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useWorkoutStore.getState().draft?.profileId).toBe(ivo.id);
  });

  it('mentions the workout in the delete confirmation of its owner only', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    const marko = await repo.profiles.create({ name: 'Marko' });
    useWorkoutStore.getState().startQuick(ivo.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    fireEvent.click(await screen.findByTestId(`settings-profile-delete-${marko.id}`));
    let dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveTextContent('The workout in progress belongs to this profile');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByTestId(`settings-profile-delete-${ivo.id}`));
    dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('The workout in progress belongs to this profile and is discarded too.');
    fireEvent.change(within(dialog).getByLabelText('Type Ivo to confirm'), { target: { value: 'Ivo' } });
    fireEvent.click(within(dialog).getByTestId('settings-profile-delete-confirm'));
    await waitFor(() => expect(useWorkoutStore.getState().draft).toBeNull());
    expect((await repo.profiles.list()).map((p) => p.name).sort()).toEqual(['Ana', 'Marko']);
  });
});
