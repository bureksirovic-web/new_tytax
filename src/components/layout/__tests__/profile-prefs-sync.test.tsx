import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { Profile } from '@/contracts/domain';
import { buildProfile, sequentialIds } from '@/contracts/fixtures';

const state = vi.hoisted(() => ({ profile: undefined as Profile | undefined }));
const apply = vi.fn();
vi.mock('@/hooks/use-repo', () => ({ useActiveProfile: () => ({ profile: state.profile, profileId: state.profile?.id, loading: false }) }));
vi.mock('@/components/settings/use-apply-profile-prefs', () => ({ useApplyProfilePrefs: () => apply }));

import { ProfilePrefsSync } from '../profile-prefs-sync';

const ids = sequentialIds('p');
const make = (language: 'hr' | 'en', theme: 'tactical' | 'oled' = 'tactical') =>
  buildProfile({ name: 'Ana', settings: { language, theme } }, new Date('2026-09-26T10:00:00.000Z'), ids);

describe('ProfilePrefsSync', () => {
  beforeEach(() => {
    apply.mockClear();
    state.profile = undefined;
  });

  it('applies nothing until a profile exists, then applies it once', () => {
    const { rerender } = render(<ProfilePrefsSync />);
    expect(apply).not.toHaveBeenCalled();

    state.profile = make('hr');
    rerender(<ProfilePrefsSync />);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith(state.profile);
  });

  it('re-applies only when language or theme changes, not on every emission', () => {
    state.profile = make('hr');
    const { rerender } = render(<ProfilePrefsSync />);
    expect(apply).toHaveBeenCalledTimes(1);

    state.profile = { ...state.profile, updatedAt: '2026-09-26T11:00:00.000Z' };
    rerender(<ProfilePrefsSync />);
    expect(apply).toHaveBeenCalledTimes(1);

    state.profile = { ...state.profile, settings: { ...state.profile.settings, language: 'en' } };
    rerender(<ProfilePrefsSync />);
    expect(apply).toHaveBeenCalledTimes(2);

    state.profile = { ...state.profile, settings: { ...state.profile.settings, theme: 'oled' } };
    rerender(<ProfilePrefsSync />);
    expect(apply).toHaveBeenCalledTimes(3);
  });
});
