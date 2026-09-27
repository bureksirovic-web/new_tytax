import { describe, expect, it } from 'vitest';
import type { Profile } from '@/contracts/domain';
import { RepoError } from '@/contracts/repo';
import { legacyErrorKey, type LegacyUserPreview } from '../legacy-import-api';
import { checkMapping, choiceFromValue, defaultChoices } from '../legacy-import-model';

const user = (username: string): LegacyUserPreview => ({
  username,
  logs: 0,
  sets: 0,
  bodyweight: 0,
  programs: 0,
  unresolved: [],
  warnings: [],
});
const profile = (id: string, name: string) => ({ id, name }) as Profile;

describe('checkMapping', () => {
  const users = [user('Ana'), user('ana')];

  it('defaults every user to a new profile with its own name', () => {
    expect(defaultChoices([user('Ana')])).toEqual({ Ana: { kind: 'new', name: 'Ana' } });
  });

  it('flags new names that clash with each other case-insensitively', () => {
    const check = checkMapping(users, defaultChoices(users), []);
    expect(check.names).toEqual({ ana: 'taken' });
    expect(check.options).toBeNull();
  });

  it('builds importLegacy options, skipping users and trimming names', () => {
    const check = checkMapping(
      users,
      { Ana: { kind: 'existing', profileId: 'p1' }, ana: { kind: 'new', name: '  Ivo ' } },
      [profile('p1', 'Tomi')],
    );
    expect(check.options).toEqual({
      users: [
        { username: 'Ana', target: { profileId: 'p1' } },
        { username: 'ana', target: { createProfileName: 'Ivo' } },
      ],
    });
  });

  it('reports nothing selected and a profile targeted twice', () => {
    expect(checkMapping(users, { Ana: { kind: 'skip' }, ana: { kind: 'skip' } }, []).problem).toBe('nothing');
    const same = { kind: 'existing', profileId: 'p1' } as const;
    expect(checkMapping(users, { Ana: same, ana: same }, []).problem).toBe('same_profile');
  });

  it('keeps a typed name when switching back to a new profile', () => {
    expect(choiceFromValue('new', 'Ana', { kind: 'new', name: 'X' })).toEqual({ kind: 'new', name: 'X' });
    expect(choiceFromValue('new', 'Ana', { kind: 'skip' })).toEqual({ kind: 'new', name: 'Ana' });
    expect(choiceFromValue('p:abc', 'Ana', { kind: 'skip' })).toEqual({ kind: 'existing', profileId: 'abc' });
  });
});

describe('legacyErrorKey', () => {
  it('maps G2 ImportError and RepoError codes, anything else is generic', () => {
    expect(legacyErrorKey({ code: 'TOO_LARGE' })).toBe('set_import_error_too_large');
    expect(legacyErrorKey({ code: 'INVALID_JSON' })).toBe('set_import_error_invalid_json');
    expect(legacyErrorKey({ code: 'UNSAFE_KEYS' })).toBe('set_import_error_unsafe');
    expect(legacyErrorKey({ code: 'INVALID_STRUCTURE' })).toBe('set_legacy_error_structure');
    expect(legacyErrorKey(new RepoError('VALIDATION', 'x'))).toBe('set_legacy_error_validation');
    expect(legacyErrorKey(new RepoError('CONFLICT', 'x'))).toBe('set_legacy_error_conflict');
    expect(legacyErrorKey({ code: 'toString' })).toBe('set_action_failed');
    expect(legacyErrorKey(new Error('boom'))).toBe('set_action_failed');
  });
});
