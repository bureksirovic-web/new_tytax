import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';

const active = vi.fn<() => { profile: Profile | undefined; profileId: string | undefined; loading: boolean }>();
vi.mock('@/hooks/use-repo', () => ({ useActiveProfile: () => active() }));

import { LocaleProvider } from '@/components/providers/locale-provider';
import { ProfilePlateCalculator } from '../profile-plate-calculator';
import { PlateCalculator } from '../plate-calculator';

function profileWith(settings: Partial<Profile['settings']>): Profile {
  return { id: 'p1', settings: { ...DEFAULT_PROFILE_SETTINGS, ...settings } } as Profile;
}

function plates(): (string | null)[] {
  return within(screen.getByTestId('plate-per-side'))
    .queryAllByRole('listitem')
    .map((li) => li.textContent);
}

function renderProfile() {
  render(
    <LocaleProvider>
      <ProfilePlateCalculator />
    </LocaleProvider>,
  );
}

describe('PlateCalculator platesKg', () => {
  it('uses only the given plate sizes', () => {
    render(
      <LocaleProvider>
        <PlateCalculator platesKg={[20, 10, 5]} />
      </LocaleProvider>,
    );
    // (100 - 20) / 2 = 40 per side -> 20 + 20 (no 25 or 15 in the set)
    expect(plates()).toEqual(['20', '20']);
    expect(screen.getByTestId('plate-loaded-total')).toHaveTextContent('100 kg');
  });
});

describe('ProfilePlateCalculator', () => {
  beforeEach(() => {
    localStorage.clear();
    active.mockReset();
  });

  it('shows a loading line until the profile query settles', () => {
    active.mockReturnValue({ profile: undefined, profileId: undefined, loading: true });
    renderProfile();
    expect(screen.getByTestId('plate-loading')).toHaveTextContent('Loading...');
    expect(screen.queryByTestId('plate-per-side')).not.toBeInTheDocument();
  });

  it('seeds bar weight and plate set from the active profile settings', () => {
    active.mockReturnValue({
      profile: profileWith({ barWeightKg: 15, plateSetKg: [20, 10, 5, 2.5] }),
      profileId: 'p1',
      loading: false,
    });
    renderProfile();
    expect(screen.getByLabelText('Bar weight (kg)')).toHaveValue('15');
    // (100 - 15) / 2 = 42.5 per side -> 20 + 20 + 2.5
    expect(plates()).toEqual(['20', '20', '2.5']);
    expect(screen.getByTestId('plate-loaded-total')).toHaveTextContent('100 kg');
  });

  it('falls back to 20 kg and the standard set without a profile', () => {
    active.mockReturnValue({ profile: undefined, profileId: undefined, loading: false });
    renderProfile();
    expect(screen.getByLabelText('Bar weight (kg)')).toHaveValue('20');
    // (100 - 20) / 2 = 40 -> 25 + 15
    expect(plates()).toEqual(['25', '15']);
    expect(screen.getByTestId('plate-loaded-total')).toHaveTextContent('100 kg');
  });

  it('falls back when the stored settings are unusable', () => {
    active.mockReturnValue({
      profile: profileWith({ barWeightKg: Number.NaN, plateSetKg: [] }),
      profileId: 'p1',
      loading: false,
    });
    renderProfile();
    expect(screen.getByLabelText('Bar weight (kg)')).toHaveValue('20');
    expect(plates()).toEqual(['25', '15']);
    expect(screen.getByTestId('plate-loaded-total')).toHaveTextContent('100 kg');
  });
});
