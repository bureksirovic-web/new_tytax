// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTH_STRINGS, authErrorKey, translateAuth } from '../i18n';

describe('auth i18n fallback', () => {
  it('en and hr define the same keys, none blank', () => {
    expect(Object.keys(AUTH_STRINGS.hr).sort()).toEqual(Object.keys(AUTH_STRINGS.en).sort());
    for (const table of [AUTH_STRINGS.en, AUTH_STRINGS.hr]) {
      for (const value of Object.values(table)) expect(value.trim()).not.toBe('');
    }
  });

  it('matches the request table in docs/v2/requests/G5-i18n.md', () => {
    const md = readFileSync(path.resolve(__dirname, '../../../../docs/v2/requests/G5-i18n.md'), 'utf8');
    const rows = new Map<string, { hr: string; en: string }>();
    for (const line of md.split('\n')) {
      const m = line.match(/^\| `([^`]+)` \| (.*) \| (.*) \|$/);
      if (m) rows.set(m[1], { hr: m[2], en: m[3] });
    }
    expect(rows.size).toBe(Object.keys(AUTH_STRINGS.en).length);
    for (const [key, en] of Object.entries(AUTH_STRINGS.en)) {
      expect(rows.get(key)).toEqual({ en, hr: AUTH_STRINGS.hr[key as keyof typeof AUTH_STRINGS.hr] });
    }
  });

  it('maps error codes to keys, unknown → auth_failed', () => {
    expect(authErrorKey('otp_expired')).toBe('auth.error.otp_expired');
    expect(authErrorKey('auth_not_configured')).toBe('auth.error.auth_not_configured');
    expect(authErrorKey('nonsense')).toBe('auth.error.auth_failed');
    expect(authErrorKey('constructor')).toBe('auth.error.auth_failed');
    expect(authErrorKey(null)).toBe('auth.error.auth_failed');
  });

  it('prefers the dictionary, falls back when it echoes the key', () => {
    expect(translateAuth('auth.login.submit', 'en', () => 'From dictionary')).toBe('From dictionary');
    expect(translateAuth('auth.login.submit', 'hr', (k) => k)).toBe(AUTH_STRINGS.hr['auth.login.submit']);
    expect(translateAuth('auth.login.submit', 'xx', () => undefined)).toBe(AUTH_STRINGS.en['auth.login.submit']);
  });
});
