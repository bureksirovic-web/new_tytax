import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }));

const { default: ProgramsPage } = await import('@/app/(app)/programs/page-client');
const { ALL_PRESETS, DEFAULT_TYTAX_PRESET_ID } = await import('@/lib/programs/presets');

/** G3-03: stable e2e hooks on the preset install controls. */
describe('Programs page preset install test ids', () => {
  it('gives every preset exactly one install-preset (and one install-only) control carrying its preset id', async () => {
    const repo = createRepository({ db: new TytaxDatabase('preset-testids-1') });
    holder.repo = repo;
    await repo.profiles.ensureActive('Me');
    const { container } = render(<ProgramsPage />);
    await screen.findAllByTestId('preset-card');
    const ids = ALL_PRESETS.map((p) => p.presetId);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    const primary = screen.getAllByTestId('install-preset').map((b) => b.getAttribute('data-preset-id'));
    const only = screen.getAllByTestId('install-preset-only').map((b) => b.getAttribute('data-preset-id'));
    expect(primary).toEqual(ids);
    expect(only).toEqual(ids);
    for (const id of ids) expect(container.querySelectorAll(`[data-testid="install-preset"][data-preset-id="${id}"]`)).toHaveLength(1);
  });

  it('the TYTAX preset installs and activates through its install-preset control, which then reads "install again"', async () => {
    const repo = createRepository({ db: new TytaxDatabase('preset-testids-2') });
    holder.repo = repo;
    const me = await repo.profiles.ensureActive('Me');
    const { container } = render(<ProgramsPage />);
    await screen.findAllByTestId('preset-card');
    const selector = `[data-testid="install-preset"][data-preset-id="${DEFAULT_TYTAX_PRESET_ID}"]`;
    const button = container.querySelector<HTMLButtonElement>(selector)!;
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(holder.push).toHaveBeenCalledTimes(1));
    const [installed] = await repo.programs.list(me.id);
    expect(installed.presetId).toBe(DEFAULT_TYTAX_PRESET_ID);
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(installed.id);
    await waitFor(() => expect(container.querySelector(selector)).toHaveTextContent('prog_install_again'));
    expect(container.querySelector(`[data-testid="install-preset-only"][data-preset-id="${DEFAULT_TYTAX_PRESET_ID}"]`)).toBeNull();
  });
});
