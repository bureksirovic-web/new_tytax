import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { useT } from '../use-t';

const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;

describe('useT', () => {
  it('translates with interpolation and follows setLocale', () => {
    const { result } = renderHook(() => useT(), { wrapper });

    act(() => result.current.setLocale('en'));
    expect(result.current.locale).toBe('en');
    expect(result.current.t('workout_set_n', { n: 2 })).toBe('Set 2');

    act(() => result.current.setLocale('hr'));
    expect(result.current.locale).toBe('hr');
    expect(result.current.t('workout_set_n', { n: 2 })).toBe('Serija 2');
    expect(result.current.t('save')).toBe('Spremi');
  });
});
