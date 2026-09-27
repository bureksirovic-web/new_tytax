import { describe, expect, it } from 'vitest';
import type { Profile } from '@/contracts/domain';
import { buildProfile, sequentialIds } from '@/contracts/fixtures';
import { clampRest, formatRest, parseDecimal, sortProfiles, toProviderTheme, validateProfileName } from '../settings-utils';
import { toggleId } from '../equipment-labels';
import { isSyncEnabled } from '../sync-slot';

const ids = sequentialIds('p');
const at = (iso: string, name: string): Profile => ({ ...buildProfile({ name }, new Date(iso), ids), createdAt: iso });

describe('validateProfileName', () => {
  const existing = [at('2026-01-01T00:00:00Z', 'Ana')];

  it('requires 1–40 non-blank characters', () => {
    expect(validateProfileName('   ', existing)).toBe('required');
    expect(validateProfileName('x'.repeat(41), existing)).toBe('too_long');
    expect(validateProfileName(` ${'x'.repeat(40)} `, existing)).toBeNull();
  });

  it('rejects a duplicate case-insensitively, but not the profile itself', () => {
    expect(validateProfileName(' ana ', existing)).toBe('taken');
    expect(validateProfileName('ANA', existing, existing[0].id)).toBeNull();
    expect(validateProfileName('Marko', existing)).toBeNull();
  });
});

describe('sortProfiles', () => {
  it('puts the active profile first, then the oldest', () => {
    const a = at('2026-01-01T00:00:00Z', 'A');
    const b = at('2026-02-01T00:00:00Z', 'B');
    const c = at('2026-03-01T00:00:00Z', 'C');
    const rows = [c, a, b].map((profile) => ({ profile }));
    expect(sortProfiles(rows, c.id).map((r) => r.profile.name)).toEqual(['C', 'A', 'B']);
    expect(sortProfiles(rows, undefined).map((r) => r.profile.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('rest helpers', () => {
  it('formats seconds as m:ss', () => {
    // 90 s = 1 min 30 s; 600 s = 10 min
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(45)).toBe('0:45');
    expect(formatRest(600)).toBe('10:00');
  });

  it('clamps to 15–600 s in 15 s steps', () => {
    expect(clampRest(0)).toBe(15);
    expect(clampRest(615)).toBe(600);
    // 97 / 15 = 6.47 → 6 steps = 90
    expect(clampRest(97)).toBe(90);
  });
});

describe('parseDecimal', () => {
  it('reads dot and comma decimals and rejects junk', () => {
    expect(parseDecimal('7.5')).toBe(7.5);
    expect(parseDecimal(' 7,5 ')).toBe(7.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-3')).toBeUndefined();
    expect(parseDecimal('1e3')).toBeUndefined();
  });
});

describe('small mappers', () => {
  it('maps the stored theme to the provider theme', () => {
    expect(toProviderTheme('oled')).toBe('oled');
    expect(toProviderTheme('tactical')).toBe('dark');
  });

  it('toggles ids without duplicates', () => {
    expect(toggleId(['a', 'b'], 'a', true)).toEqual(['b', 'a']);
    expect(toggleId(['a', 'b'], 'a', false)).toEqual(['b']);
  });

  it('reads the sync flag', () => {
    expect(isSyncEnabled(undefined)).toBe(false);
    expect(isSyncEnabled('1')).toBe(true);
    expect(isSyncEnabled('true')).toBe(true);
    expect(isSyncEnabled('0')).toBe(false);
  });
});
