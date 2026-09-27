import { describe, it, expect } from 'vitest';
import { formatWeight, formatDate, toDisplayWeight, fromDisplayWeight } from '../format';

describe('weight units', () => {
  it('keeps kg as is', () => {
    expect(toDisplayWeight(100, 'kg')).toBe(100);
    expect(fromDisplayWeight(100, 'kg')).toBe(100);
  });

  it('converts kg to lb for display', () => {
    // 100 kg × 2.20462 = 220.462 → rounded to 0.1 = 220.5
    expect(toDisplayWeight(100, 'lb')).toBe(220.5);
    // 20 kg × 2.20462 = 44.0924 → 44.1
    expect(toDisplayWeight(20, 'lb')).toBe(44.1);
  });

  it('converts lb input back to kg', () => {
    // 225 lb / 2.20462 = 102.0584… → 102.06
    expect(fromDisplayWeight(225, 'lb')).toBe(102.06);
    expect(fromDisplayWeight(0, 'lb')).toBe(0);
  });

  it('formats with unit and locale decimal separator', () => {
    expect(formatWeight(62.5, 'kg', 'hr')).toBe('62,5 kg');
    expect(formatWeight(62.5, 'kg', 'en')).toBe('62.5 kg');
    expect(formatWeight(100, 'lb', 'en')).toBe('220.5 lb');
  });
});

describe('formatDate', () => {
  it('formats valid dates per locale', () => {
    const d = new Date(2026, 8, 26);
    expect(formatDate(d, 'en')).toContain('2026');
    expect(formatDate(d, 'hr')).toContain('2026');
    expect(formatDate(d.getTime(), 'en', { year: 'numeric' })).toBe('2026');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatDate('not a date', 'hr')).toBe('');
  });
});
