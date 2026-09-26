import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));

const { default: ProgramsPage } = await import('@/app/(app)/programs/page-client');
const { ALL_PRESETS } = await import('@/lib/programs/presets');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`programs-page-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  return repo;
}

describe('ProgramsPage', () => {
  it('installs a preset through the repository and activates it when none is active', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<ProgramsPage />);

    // Without a LocaleProvider `t` returns the key.
    expect(await screen.findByText('no_programs_yet')).toBeInTheDocument();
    const installButtons = screen.getAllByRole('button', { name: 'install' });
    expect(installButtons).toHaveLength(ALL_PRESETS.length);
    // Enabled once the active profile has loaded.
    await waitFor(() => expect(installButtons[0]).toBeEnabled());

    fireEvent.click(installButtons[0]);
    await waitFor(() => expect(holder.push).toHaveBeenCalledTimes(1));

    const programs = await repo.programs.list(me.id);
    // one preset installed → one program
    expect(programs).toHaveLength(1);
    expect(programs[0].presetId).toBe(ALL_PRESETS[0].presetId);
    expect(holder.push).toHaveBeenCalledWith(`/programs/${programs[0].id}`);
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(programs[0].id);
  });

  it('marks the profile active program and activates another via setActive', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const first = await repo.programs.create(me.id, { ...ALL_PRESETS[0], name: 'First' }, { activate: true });
    const second = await repo.programs.create(me.id, { ...ALL_PRESETS[0], name: 'Second' });
    render(<ProgramsPage />);

    const secondCard = (await screen.findByText('Second')).closest('[role="button"]');
    expect(secondCard).not.toBeNull();
    const firstCard = screen.getByText('First').closest('[role="button"]');
    expect(within(firstCard as HTMLElement).getByRole('button', { name: 'active' })).toBeDisabled();

    fireEvent.click(within(secondCard as HTMLElement).getByRole('button', { name: 'activate_program' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(second.id));
    expect(first.id).not.toBe(second.id);
    // Activating never navigates.
    expect(holder.push).not.toHaveBeenCalled();
  });

  it('opens the detail page when a program card is clicked', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const p = await repo.programs.create(me.id, { ...ALL_PRESETS[0], name: 'Mine' });
    render(<ProgramsPage />);

    fireEvent.click(await screen.findByText('Mine'));
    expect(holder.push).toHaveBeenCalledWith(`/programs/${p.id}`);
    expect(holder.push).toHaveBeenCalledTimes(1);
  });
});
