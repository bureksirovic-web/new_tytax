import { describe, it, expect, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { MUSCLE_GROUPS } from '@/lib/constants';
import { MUSCLE_STRINGS, muscleNameKey, useMuscleName } from '../muscles';

describe('muscle name table', () => {
  it('has one en and one hr name per standard muscle, with unique keys', () => {
    const keys = MUSCLE_GROUPS.map(muscleNameKey);
    expect(new Set(keys).size).toBe(MUSCLE_GROUPS.length);
    expect(Object.keys(MUSCLE_STRINGS.en).sort()).toEqual([...keys].sort());
    expect(Object.keys(MUSCLE_STRINGS.hr).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      expect(MUSCLE_STRINGS.en[k].trim()).not.toBe('');
      expect(MUSCLE_STRINGS.hr[k].trim()).not.toBe('');
    }
  });

  it('builds slug keys', () => {
    expect(muscleNameKey('Mid/Lower Traps')).toBe('muscle_name_mid_lower_traps');
    expect(muscleNameKey('Rear Delts')).toBe('muscle_name_rear_delts');
  });

  it('localises standard muscles in hr and passes unknown names through', async () => {
    localStorage.setItem('locale', 'hr');
    const wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    const { result } = renderHook(() => useMuscleName(), { wrapper });
    await waitFor(() => expect(result.current('Rear Delts')).toBe('Stražnja ramena'));
    expect(result.current('Mystery Muscle')).toBe('Mystery Muscle');
  });
});

afterEach(() => localStorage.clear());
