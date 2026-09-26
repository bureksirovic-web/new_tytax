import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { LocaleProvider } = await import('@/components/providers/locale-provider');
const { ThemeProvider } = await import('@/components/providers/theme-provider');
const { FamilySection } = await import('../family-section');
const { PreferencesSection } = await import('../preferences-section');
const { ProfileSection } = await import('../profile-section');
const { TrainingSection } = await import('../training-section');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`settings-${n}`) });
  holder.repo = repo;
  return repo;
}

describe('FamilySection', () => {
  it('adds, switches to and removes family profiles through the repository', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const onSwitched = vi.fn();
    render(<FamilySection activeId={me.id} onSwitched={onSwitched} />);

    expect(await screen.findByText('Me')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('member_name'), { target: { value: '  Ana ' } });
    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    const anaRow = (await screen.findByText('Ana')).closest('li') as HTMLElement;
    // Me + Ana
    await waitFor(async () => expect(await repo.profiles.list()).toHaveLength(2));
    const ana = (await repo.profiles.list()).find((p) => p.name === 'Ana');
    expect(ana).toBeDefined();

    fireEvent.click(within(anaRow).getByRole('button', { name: 'make_active' }));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(ana?.id));
    expect(onSwitched).toHaveBeenCalledWith(expect.objectContaining({ id: ana?.id }));

    fireEvent.click(within(anaRow).getByRole('button', { name: 'delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'delete' }));
    await waitFor(async () => expect((await repo.profiles.list()).map((p) => p.name)).toEqual(['Me']));
    // Removing the active profile hands "active" to the remaining one.
    expect(await repo.profiles.getActiveId()).toBe(me.id);
  });

  it('never offers to delete the last profile', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Solo');
    render(<FamilySection activeId={me.id} />);
    const row = (await screen.findByText('Solo')).closest('li') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'delete' })).toBeDisabled();
    expect(within(row).getByText('active')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'make_active' })).toBeNull();
  });
});

describe('PreferencesSection', () => {
  it('persists units, theme (dark ↔ tactical) and language, and updates the providers', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const enProfile = await repo.profiles.updateSettings(me.id, { language: 'en' });
    // Real providers: the locale starts at 'en' (nothing in localStorage), the theme at 'dark'.
    render(
      <ThemeProvider>
        <LocaleProvider>
          <PreferencesSection profile={enProfile} />
        </LocaleProvider>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByLabelText('lb / mi'));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.units).toBe('lb'));

    fireEvent.click(screen.getByLabelText('OLED'));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.theme).toBe('oled'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
    fireEvent.click(screen.getByLabelText('Dark'));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.theme).toBe('tactical'));

    fireEvent.click(screen.getByLabelText('Hrvatski'));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.language).toBe('hr'));
    // The provider switched too: the dark-theme label is now Croatian.
    expect(screen.getByLabelText('Tamna')).toBeChecked();
  });
});

describe('ProfileSection', () => {
  it('saves the name and converts a bodyweight entered in lb to kg', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const lbProfile = await repo.profiles.updateSettings(me.id, { units: 'lb' });
    render(<ProfileSection profile={lbProfile} />);

    fireEvent.change(screen.getByLabelText('display_name'), { target: { value: 'Tomi' } });
    fireEvent.change(screen.getByLabelText('bodyweight (lb)'), { target: { value: '220.462' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(async () => expect((await repo.profiles.get(me.id))?.name).toBe('Tomi'));
    // 220.462 lb / 2.20462 = 100 kg
    expect((await repo.profiles.get(me.id))?.bodyweightKg).toBeCloseTo(100, 6);
  });

  it('blocks saving a zero bodyweight', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<ProfileSection profile={me} />);
    fireEvent.change(screen.getByLabelText('bodyweight (kg)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect((await repo.profiles.get(me.id))?.bodyweightKg).toBeUndefined();
  });
});

describe('TrainingSection', () => {
  it('saves rest seconds, bar weight and the warm-up strategy', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<TrainingSection profile={me} />);

    fireEvent.change(screen.getByLabelText('workout_rest_timer'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('workout_weight_kg'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.restSeconds).toBe(120));
    // bar weight entered in kg is stored as-is
    expect((await repo.profiles.get(me.id))?.settings.barWeightKg).toBe(15);

    fireEvent.click(screen.getByLabelText('pyramid'));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.settings.warmupStrategy).toBe('pyramid'));
  });
});
