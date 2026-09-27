import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { installRepo, oneSetLog, renderWithProviders, seedLogs, toastMessages, type Holder } from './settings-harness';

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

const names = async () => (await repo.profiles.list()).map((p) => p.name).sort();

describe('ProfilesCard', () => {
  it('lists profiles with the active one first, badges and workout counts', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    await seedLogs(repo, ana.id, [oneSetLog(1), oneSetLog(2)]);
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    const anaRow = await screen.findByTestId(`settings-profile-row-${ana.id}`);
    expect(within(anaRow).getByText('Current')).toBeInTheDocument();
    expect(await within(anaRow).findByText('Workouts: 2')).toBeInTheDocument();
    // the active row has no switch button; the other row does
    expect(within(anaRow).queryByRole('button', { name: 'Switch to Ana' })).toBeNull();
    expect(screen.getByTestId(`settings-profile-switch-${ivo.id}`)).toHaveAccessibleName('Switch to Ivo');
    const rows = within(screen.getByTestId('settings-profile-list')).getAllByRole('listitem');
    expect(rows[0]).toBe(anaRow);
  });

  it('creates a profile, rejects a case-insensitive duplicate and activates the new one', async () => {
    await repo.profiles.ensureActive('Ana');
    renderWithProviders(<ProfilesCard activeId={undefined} />);
    await screen.findByText('Ana');

    const input = screen.getByTestId('settings-profile-name-input');
    fireEvent.change(input, { target: { value: ' ana ' } });
    fireEvent.click(screen.getByTestId('settings-profile-create'));
    expect(await screen.findByText('A profile with this name already exists')).toBeInTheDocument();
    expect(await names()).toEqual(['Ana']);

    fireEvent.change(input, { target: { value: '  Marko ' } });
    fireEvent.click(screen.getByTestId('settings-profile-create'));
    await waitFor(async () => expect(await names()).toEqual(['Ana', 'Marko']));
    const marko = (await repo.profiles.list()).find((p) => p.name === 'Marko');
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(marko?.id));
    // created with the UI's current language (en in tests) and the chosen units (kg default)
    expect(marko?.settings.language).toBe('en');
    expect(marko?.settings.units).toBe('kg');
    expect(toastMessages()).toContain('Profile Marko created');
  });

  it('switches profile and applies its language immediately', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo', settings: { language: 'hr', theme: 'oled' } });
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    fireEvent.click(await screen.findByTestId(`settings-profile-switch-${ivo.id}`));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(ivo.id));
    // Ivo's Croatian and OLED theme are applied to the providers
    expect(await screen.findByText('Obiteljski profili dijele ovaj uređaj i nisu zaštićeni lozinkom.')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
    expect(window.localStorage.getItem('locale')).toBe('hr');
  });

  it('warns before switching away from a profile with a workout in progress', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    useWorkoutStore.getState().startQuick(ana.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    fireEvent.click(await screen.findByTestId(`settings-profile-switch-${ivo.id}`));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A workout is in progress. It stays saved on profile Ana.')).toBeInTheDocument();
    expect(await repo.profiles.getActiveId()).toBe(ana.id);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch' }));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(ivo.id));
    // the draft stays with its owner
    expect(useWorkoutStore.getState().draft?.profileId).toBe(ana.id);
  });

  it('deletes only the chosen profile after typing its name', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    await seedLogs(repo, ana.id, [oneSetLog(1)]);
    await seedLogs(repo, ivo.id, [oneSetLog(1), oneSetLog(2)]);
    renderWithProviders(<ProfilesCard activeId={ana.id} />);

    fireEvent.click(await screen.findByTestId(`settings-profile-delete-${ivo.id}`));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete Ivo?')).toBeInTheDocument();
    const confirm = within(dialog).getByTestId('settings-profile-delete-confirm');
    fireEvent.change(within(dialog).getByLabelText('Type Ivo to confirm'), { target: { value: 'ivo' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Type Ivo to confirm'), { target: { value: 'Ivo' } });
    fireEvent.click(confirm);

    await waitFor(async () => expect(await names()).toEqual(['Ana']));
    expect(await repo.logs.count(ivo.id)).toBe(0);
    // Ana's single log is untouched
    expect(await repo.logs.count(ana.id)).toBe(1);
    expect(await repo.profiles.getActiveId()).toBe(ana.id);
  });

  it('deleting a profile drops its workout in progress, not another profile’s', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    useWorkoutStore.getState().startQuick(ivo.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);
    fireEvent.click(await screen.findByTestId(`settings-profile-delete-${ivo.id}`));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Type Ivo to confirm'), { target: { value: 'Ivo' } });
    fireEvent.click(within(dialog).getByTestId('settings-profile-delete-confirm'));
    await waitFor(async () => expect(await names()).toEqual(['Ana']));
    await waitFor(() => expect(useWorkoutStore.getState().draft).toBeNull());
  });

  it('deleting another profile keeps the active profile’s workout in progress', async () => {
    const ana = await repo.profiles.ensureActive('Ana');
    const ivo = await repo.profiles.create({ name: 'Ivo' });
    useWorkoutStore.getState().startQuick(ana.id, 'Quick');
    renderWithProviders(<ProfilesCard activeId={ana.id} />);
    fireEvent.click(await screen.findByTestId(`settings-profile-delete-${ivo.id}`));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Type Ivo to confirm'), { target: { value: 'Ivo' } });
    fireEvent.click(within(dialog).getByTestId('settings-profile-delete-confirm'));
    await waitFor(async () => expect(await names()).toEqual(['Ana']));
    expect(useWorkoutStore.getState().draft?.profileId).toBe(ana.id);
  });

  it('blocks deleting the last profile and says why', async () => {
    const solo = await repo.profiles.ensureActive('Solo');
    renderWithProviders(<ProfilesCard activeId={solo.id} />);
    const del = await screen.findByTestId(`settings-profile-delete-${solo.id}`);
    expect(del).toBeDisabled();
    expect(del).toHaveAccessibleDescription('The last profile cannot be deleted');
    expect(screen.queryByTestId(`settings-profile-switch-${solo.id}`)).toBeNull();
  });
});
