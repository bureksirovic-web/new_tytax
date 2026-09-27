import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProgramTemplate } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }));

const { default: ProgramsPage } = await import('@/app/(app)/programs/page-client');
const { ALL_PRESETS, DEFAULT_TYTAX_PRESET_ID } = await import('@/lib/programs/presets');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`programs-page-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  holder.replace.mockClear();
  return repo;
}

const slot = (id: string) => ({ exerciseId: id, exerciseName: id, modality: 'tytax' as const, sets: 3, reps: '8' });
const tpl = (name: string, filled: boolean): ProgramTemplate => ({
  name,
  splitType: 'upper_lower',
  frequency: 2,
  periodizationType: 'none',
  sessionOrder: ['Upper A', 'Lower A'],
  sessions: [
    { id: 'a', programId: '', name: 'Upper A', dayIndex: 0, exercises: filled ? [slot('bench')] : [] },
    { id: 'b', programId: '', name: 'Lower A', dayIndex: 1, exercises: [slot('squat')] },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 1,
});

function card(name: string): HTMLElement {
  const el = screen.getAllByTestId('program-card').find((c) => within(c).queryByText(name));
  if (!el) throw new Error(`no card ${name}`);
  return el;
}

describe('ProgramsPage', () => {
  it('shows the heading, the empty state and every preset including the default TYTAX split', async () => {
    const repo = installRepo();
    await repo.profiles.ensureActive('Me');
    render(<ProgramsPage />);
    expect(screen.getByTestId('page-heading-programs')).toHaveTextContent('prog_title');
    expect(await screen.findByText('prog_empty_title')).toBeInTheDocument();
    const presets = screen.getAllByTestId('preset-card');
    expect(presets).toHaveLength(ALL_PRESETS.length);
    const tytax = ALL_PRESETS.find((p) => p.presetId === DEFAULT_TYTAX_PRESET_ID);
    expect(tytax).toBeDefined();
    expect(screen.getByText(tytax!.name)).toBeInTheDocument();
  });

  it('"Install & activate" creates the program, activates it and opens it', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<ProgramsPage />);
    const buttons = await screen.findAllByRole('button', { name: 'prog_install_activate' });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(holder.push).toHaveBeenCalledTimes(1));
    const programs = await repo.programs.list(me.id);
    expect(programs).toHaveLength(1);
    expect(programs[0].presetId).toBe(ALL_PRESETS[0].presetId);
    expect(holder.push).toHaveBeenCalledWith(`/programs/${programs[0].id}`);
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(programs[0].id);
  });

  it('"Install only" leaves the active program alone and marks the preset installed', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const mine = await repo.programs.create(me.id, tpl('Mine', true), { activate: true });
    render(<ProgramsPage />);
    const presetCard = (await screen.findAllByTestId('preset-card'))[0];
    const only = within(presetCard).getByRole('button', { name: 'prog_install_only' });
    await waitFor(() => expect(only).toBeEnabled());
    fireEvent.click(only);
    await waitFor(() => expect(holder.push).toHaveBeenCalledTimes(1));
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(mine.id);
    expect(await repo.programs.list(me.id)).toHaveLength(2);
    expect(await within(presetCard).findByText('prog_installed')).toBeInTheDocument();
    expect(within(presetCard).getByRole('button', { name: 'prog_install_again' })).toBeInTheDocument();
  });

  it('activates a complete program, gates an incomplete one, and shows the next session', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const done = await repo.programs.create(me.id, tpl('Done', true));
    await repo.programs.create(me.id, tpl('Draft', false));
    render(<ProgramsPage />);
    await screen.findByText('Draft');
    const draftBtn = within(card('Draft')).getByRole('button', { name: 'prog_activate' });
    expect(draftBtn).toBeDisabled();
    expect(within(card('Draft')).getByText('prog_incomplete')).toBeInTheDocument();
    // currentSessionIndex 1 → "Lower A"; without a provider t() returns the key (no interpolation of the key text).
    expect(within(card('Done')).getByText('prog_next_session')).toBeInTheDocument();
    fireEvent.click(within(card('Done')).getByRole('button', { name: 'prog_activate' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(done.id));
    expect(await screen.findByTestId('active-program')).toHaveTextContent('Done');
    expect(holder.push).not.toHaveBeenCalled();
  });

  it('deactivates the active program only after confirming', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    await repo.programs.create(me.id, tpl('Live', true), { activate: true });
    render(<ProgramsPage />);
    const active = await screen.findByTestId('active-program');
    // the rotation strip marks the next session (index 1)
    expect(within(active).getByText('Lower A').closest('li')).toHaveAttribute('aria-current', 'step');
    fireEvent.click(within(active).getByRole('button', { name: 'prog_deactivate' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'prog_deactivate' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull());
    await waitFor(() => expect(screen.queryByTestId('active-program')).toBeNull());
  });

  it('never lists another profile\'s or soft-deleted programs', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const other = await repo.profiles.create({ name: 'Other' });
    await repo.programs.create(other.id, tpl('Theirs', true));
    const gone = await repo.programs.create(me.id, tpl('Gone', true));
    await repo.programs.softDelete(me.id, gone.id);
    await repo.programs.create(me.id, tpl('Kept', true));
    render(<ProgramsPage />);
    expect(await screen.findByText('Kept')).toBeInTheDocument();
    expect(screen.queryByText('Theirs')).toBeNull();
    expect(screen.queryByText('Gone')).toBeNull();
  });
});
