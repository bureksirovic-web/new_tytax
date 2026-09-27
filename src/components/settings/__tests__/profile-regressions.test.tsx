/** Refuter findings on the profile forms (create during a workout, edit-name length, clearing bodyweight). */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { installRepo, renderWithProviders, toastMessages, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { ProfilesCard } = await import('../profiles-card');
const { ProfileEditForm } = await import('../profile-edit-form');
const { useWorkoutStore } = await import('@/stores/workout-store');

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  useWorkoutStore.setState({ draft: null });
  me = await repo.profiles.ensureActive('Ana');
});
const stored = async () => (await repo.profiles.get(me.id))!;

describe('ProfileCreateForm during a workout', () => {
  it('asks before activating the new profile while a workout is in progress', async () => {
    useWorkoutStore.getState().startQuick(me.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={me.id} />);
    await screen.findByText('Ana');

    fireEvent.change(screen.getByTestId('settings-profile-name-input'), { target: { value: 'Marko' } });
    fireEvent.click(screen.getByTestId('settings-profile-create'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A workout is in progress. It stays saved on profile Ana.')).toBeInTheDocument();
    const marko = (await repo.profiles.list()).find((p) => p.name === 'Marko');
    expect(marko).toBeDefined();
    expect(await repo.profiles.getActiveId()).toBe(me.id);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await repo.profiles.getActiveId()).toBe(me.id);
    expect(useWorkoutStore.getState().draft?.profileId).toBe(me.id);
    expect(toastMessages()).toContain('Profile Marko created');
  });

  it('confirming the warning activates the new profile and keeps the draft with its owner', async () => {
    useWorkoutStore.getState().startQuick(me.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={me.id} />);
    await screen.findByText('Ana');
    fireEvent.change(screen.getByTestId('settings-profile-name-input'), { target: { value: 'Marko' } });
    fireEvent.click(screen.getByTestId('settings-profile-create'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Switch' }));
    const marko = (await repo.profiles.list()).find((p) => p.name === 'Marko');
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(marko?.id));
    expect(useWorkoutStore.getState().draft?.profileId).toBe(me.id);
  });
});

describe('ProfileEditForm', () => {
  it('says the name is too long, not that it is required', async () => {
    renderWithProviders(<ProfileEditForm profile={me} />);
    fireEvent.change(screen.getByTestId('settings-profile-edit-name'), { target: { value: 'x'.repeat(41) } });
    expect(screen.getByText('The name can have at most 40 characters')).toBeInTheDocument();
    expect(screen.queryByText('Enter a name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('clearing the bodyweight clears it on the profile', async () => {
    me = await repo.profiles.update(me.id, { bodyweightKg: 80 });
    renderWithProviders(<ProfileEditForm profile={me} />);
    const field = screen.getByLabelText('Bodyweight (kg)');
    expect(field).toHaveValue('80');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toastMessages()).toContain('Profile saved'));
    expect((await stored()).bodyweightKg).toBeUndefined();
  });
});
