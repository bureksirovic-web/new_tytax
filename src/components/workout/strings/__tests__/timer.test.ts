import { describe, it, expect } from 'vitest';
import { TIMER_STRINGS, voiceLang } from '../timer';

describe('timer strings', () => {
  it('has identical en and hr keys, all non-empty', () => {
    const en = Object.keys(TIMER_STRINGS.en).sort();
    const hr = Object.keys(TIMER_STRINGS.hr).sort();
    expect(hr).toEqual(en);
    for (const table of [TIMER_STRINGS.en, TIMER_STRINGS.hr]) {
      for (const value of Object.values(table)) expect(value.trim()).not.toBe('');
    }
  });

  it('keeps the {time} placeholder in both languages', () => {
    expect(TIMER_STRINGS.en.rest_timer_remaining_label).toContain('{time}');
    expect(TIMER_STRINGS.hr.rest_timer_remaining_label).toContain('{time}');
  });

  it('starts each button accessible name with its visible text (WCAG 2.5.3)', () => {
    for (const table of [TIMER_STRINGS.en, TIMER_STRINGS.hr]) {
      expect(table.rest_timer_stop_label.toLowerCase().startsWith(table.rest_timer_stop.toLowerCase())).toBe(true);
      expect(table.rest_timer_add30_label.startsWith(table.rest_timer_add30)).toBe(true);
    }
  });

  it('maps the locale to a voice language', () => {
    expect(voiceLang('hr')).toBe('hr-HR');
    expect(voiceLang('en')).toBe('en-US');
  });
});
