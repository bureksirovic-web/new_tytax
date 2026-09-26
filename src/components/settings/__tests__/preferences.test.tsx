import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { installRepo, renderWithProviders, type Holder } from './settings-harness';

const holder = vi.hoisted((): Holder => ({ repo: undefined }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { LanguageUnitsCard } = await import('../language-units-card');
const { AppearanceCard } = await import('../appearance-card');
const { TrainingCard } = await import('../training-card');
const { ProfileEditForm } = await import('../profile-edit-form');

let repo: Repository;
let me: Profile;
beforeEach(async () => {
  repo = installRepo(holder);
  me = await repo.profiles.ensureActive('Me');
  document.documentElement.removeAttribute('data-theme');
});
const stored = async () => (await repo.profiles.get(me.id))!;

describe('LanguageUnitsCard', () => {
  it('persists the language on the profile and switches the UI at once', async () => {
    renderWithProviders(<LanguageUnitsCard profile={me} />);
    expect(screen.getByText('Weight units')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('settings-language-select'), { target: { value: 'en' } });
    await waitFor(async () => expect((await stored()).settings.language).toBe('en'));
    fireEvent.change(screen.getByTestId('settings-language-select'), { target: { value: 'hr' } });
    await waitFor(async () => expect((await stored()).settings.language).toBe('hr'));
    expect(screen.getByText('Jedinice težine')).toBeInTheDocument();
  });

  it('shows the language the UI is in, so the other one can always be chosen', async () => {
    // stored profile says hr, but the UI runs in en (e.g. switched on another screen)
    const hrProfile = await repo.profiles.updateSettings(me.id, { language: 'hr' });
    window.localStorage.setItem('locale', 'en');
    renderWithProviders(<LanguageUnitsCard profile={hrProfile} />);
    const select = screen.getByTestId('settings-language-select');
    expect(select).toHaveValue('en');
    fireEvent.change(select, { target: { value: 'hr' } });
    expect(await screen.findByText('Jedinice težine')).toBeInTheDocument();
    expect((await stored()).settings.language).toBe('hr');
  });

  it('persists units (kg/lb)', async () => {
    renderWithProviders(<LanguageUnitsCard profile={me} />);
    expect(screen.getByTestId('settings-units-select')).toHaveValue('kg');
    fireEvent.change(screen.getByTestId('settings-units-select'), { target: { value: 'lb' } });
    await waitFor(async () => expect((await stored()).settings.units).toBe('lb'));
  });
});

describe('AppearanceCard', () => {
  it('turns OLED on and off through the theme provider and the profile', async () => {
    renderWithProviders(<AppearanceCard profile={me} />);
    const sw = screen.getByRole('switch', { name: 'OLED pure black' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    await waitFor(async () => expect((await stored()).settings.theme).toBe('oled'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
  });
});

describe('TrainingCard', () => {
  it('steps the default rest by 15 s and saves it', async () => {
    renderWithProviders(<TrainingCard profile={me} />);
    // default 90 s = 1:30
    expect(screen.getByTestId('settings-rest')).toHaveTextContent('1:30');
    fireEvent.click(screen.getByRole('button', { name: 'Longer rest by 15 s' }));
    // 90 + 15 = 105
    await waitFor(async () => expect((await stored()).settings.restSeconds).toBe(105));
    fireEvent.click(screen.getByTestId('settings-rest-180'));
    await waitFor(async () => expect((await stored()).settings.restSeconds).toBe(180));
  });

  it('previews warm-ups for 100 kg per strategy and saves the choice', async () => {
    const { rerender } = renderWithProviders(<TrainingCard profile={me} />);
    const preview = screen.getByTestId('settings-warmup-preview');
    // standard, 20 kg bar: 50% → 50 × 10, 75% → 75 × 5
    expect(within(preview).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['50 kg × 10', '75 kg × 5']);

    fireEvent.click(screen.getByTestId('settings-warmup-pyramid'));
    await waitFor(async () => expect((await stored()).settings.warmupStrategy).toBe('pyramid'));
    rerender(<TrainingCard profile={await stored()} />);
    // pyramid: 40% × 12, 60% × 8, 80% × 4
    expect(within(screen.getByTestId('settings-warmup-preview')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '40 kg × 12',
      '60 kg × 8',
      '80 kg × 4',
    ]);
  });

  it('shows the preview in lb and converts a custom lb bar weight back to kg', async () => {
    const lb = await repo.profiles.updateSettings(me.id, { units: 'lb' });
    renderWithProviders(<TrainingCard profile={lb} />);
    // 100 kg × 2.20462 = 220.462 → "220.5 lb"; 50 kg → 110.231 → 110.2 lb
    expect(screen.getByText('Example for 220.5 lb working weight:')).toBeInTheDocument();
    expect(within(screen.getByTestId('settings-warmup-preview')).getAllByRole('listitem')[0]).toHaveTextContent('110.2 lb × 10');

    const bar = screen.getByTestId('settings-bar-weight');
    // 20 kg shows as 44.1 lb
    expect(bar).toHaveValue('44.1');
    fireEvent.change(bar, { target: { value: '33' } });
    fireEvent.blur(bar);
    // 33 / 2.20462 = 14.9686… → 14.97 kg
    await waitFor(async () => expect((await stored()).settings.barWeightKg).toBe(14.97));
  });

  it('does not rewrite a 15 kg bar when the lb field is only focused and left', async () => {
    const lb = await repo.profiles.updateSettings(me.id, { units: 'lb', barWeightKg: 15 });
    renderWithProviders(<TrainingCard profile={lb} />);
    const bar = screen.getByTestId('settings-bar-weight');
    // 15 × 2.20462 = 33.07 → shown "33.1"; 33.1 / 2.20462 = 15.014 → would store 15.01
    expect(bar).toHaveValue('33.1');
    fireEvent.blur(bar);
    fireEvent.keyDown(bar, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 50));
    expect((await stored()).settings.barWeightKg).toBe(15);
    expect(screen.getByTestId('settings-bar-15')).toBeChecked();
  });

  it('accepts a decimal bar weight and refuses one above 50 kg', async () => {
    renderWithProviders(<TrainingCard profile={me} />);
    const bar = screen.getByTestId('settings-bar-weight');
    fireEvent.change(bar, { target: { value: '7,5' } });
    fireEvent.keyDown(bar, { key: 'Enter' });
    await waitFor(async () => expect((await stored()).settings.barWeightKg).toBe(7.5));
    fireEvent.change(bar, { target: { value: '60' } });
    fireEvent.blur(bar);
    expect(screen.getByText('Enter a weight from 0 to 50 kg')).toBeInTheDocument();
    expect((await stored()).settings.barWeightKg).toBe(7.5);
  });
});

describe('ProfileEditForm', () => {
  it('renames and upserts today’s bodyweight entry from lb', async () => {
    const lb = await repo.profiles.updateSettings(me.id, { units: 'lb' });
    renderWithProviders(<ProfileEditForm profile={lb} />);
    fireEvent.change(screen.getByTestId('settings-profile-edit-name'), { target: { value: 'Tomi' } });
    fireEvent.change(screen.getByLabelText('Bodyweight (lb)'), { target: { value: '220.462' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await stored()).name).toBe('Tomi'));
    // 220.462 lb / 2.20462 = 100 kg
    expect((await stored()).bodyweightKg).toBe(100);
    const entries = await repo.bodyweight.list(me.id);
    expect(entries.map((e) => e.valueKg)).toEqual([100]);
  });

  it('renaming in lb keeps the stored bodyweight and writes no bodyweight entry', async () => {
    await repo.profiles.update(me.id, { bodyweightKg: 80 });
    const lb = await repo.profiles.updateSettings(me.id, { units: 'lb' });
    renderWithProviders(<ProfileEditForm profile={lb} />);
    // 80 × 2.20462 = 176.37 → shown "176.4"; 176.4 / 2.20462 = 80.014 → would store 80.01
    expect(screen.getByLabelText('Bodyweight (lb)')).toHaveValue('176.4');
    fireEvent.change(screen.getByTestId('settings-profile-edit-name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await stored()).name).toBe('Renamed'));
    expect((await stored()).bodyweightKg).toBe(80);
    expect(await repo.bodyweight.list(me.id)).toEqual([]);
  });

  it('blocks a zero bodyweight', async () => {
    renderWithProviders(<ProfileEditForm profile={me} />);
    fireEvent.change(screen.getByLabelText('Bodyweight (kg)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
  });
});
