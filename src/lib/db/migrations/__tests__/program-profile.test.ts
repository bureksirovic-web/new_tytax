import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type LegacyProgramV2, type Profile } from '@/contracts';
import { migrateProgramsV2 } from '../program';
import { migrateFamilyMemberV2, migrateProfileV2 } from '../profile';
import { v2Program, v2User } from './fixture';

describe('migrateProgramsV2', () => {
  it('picks the most recently updated non-deleted active program per profile', () => {
    const { programs, activeProgramIdByProfile } = migrateProgramsV2([
      v2Program('p-1', { isActive: true, updatedAt: '2026-03-01' }),
      v2Program('p-2', { isActive: true, updatedAt: '2026-03-05' }),
      v2Program('p-3', { isActive: true, updatedAt: '2026-03-09', deletedAt: '2026-03-09' }),
      v2Program('p-4', { profileId: 'other' }),
    ]);
    expect(activeProgramIdByProfile).toEqual({ local: 'p-2', other: null });
    expect(programs.every((p) => !('isActive' in p))).toBe(true);
  });

  it('breaks an updatedAt tie by lowest id', () => {
    const r = migrateProgramsV2([
      v2Program('p-b', { isActive: true, updatedAt: '2026-03-01' }),
      v2Program('p-a', { isActive: true, updatedAt: '2026-03-01' }),
    ]);
    expect(r.activeProgramIdByProfile).toEqual({ local: 'p-a' });
  });

  it('coerces modalities and clamps the rotation pointer', () => {
    const [high, neg, empty] = migrateProgramsV2([
      v2Program('p-1', { currentSessionIndex: 9 }),
      v2Program('p-2', { currentSessionIndex: -3 }),
      { ...v2Program('p-3'), sessions: [], currentSessionIndex: 4, sessionOrder: undefined } as unknown as LegacyProgramV2,
    ]).programs;
    expect(high.currentSessionIndex).toBe(1);
    expect(neg.currentSessionIndex).toBe(0);
    expect(empty.currentSessionIndex).toBe(0);
    expect(empty.sessionOrder).toEqual([]);
    expect(high.modalitiesUsed).toEqual(['tytax', 'custom']);
    expect(high.sessions.map((s) => s.exercises[0].modality)).toEqual(['tytax', 'custom']);
  });

  it('is idempotent', () => {
    const once = migrateProgramsV2([v2Program('p-1', { isActive: true, currentSessionIndex: 7 })]);
    const twice = migrateProgramsV2(once.programs);
    expect(twice.programs).toStrictEqual(once.programs);
    expect(twice.activeProgramIdByProfile).toEqual({});
  });
});

describe('migrateProfileV2', () => {
  it('maps v2 fields and merges over the defaults', () => {
    const p = migrateProfileV2(v2User(), 'p-2', { plateWeights: [5, 20, 10, 20, -1] });
    const expected: Profile = {
      id: 'u-1',
      name: 'Test Lifter',
      activeProgramId: 'p-2',
      settings: {
        ...DEFAULT_PROFILE_SETTINGS,
        units: 'lb',
        language: 'en',
        theme: 'oled',
        warmupStrategy: 'heavy',
        barWeightKg: 15,
        plateSetKg: [20, 10, 5],
      },
      bodyweightKg: 80,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    expect(p).toStrictEqual(expected);
  });

  it('metric -> kg, a signed-in id becomes accountId, invalid values fall back', () => {
    const bad = v2User({ unitSystem: 'metric', isAnonymous: false, barWeightKg: Number.NaN, displayName: '', createdAt: '' });
    Object.assign(bad, { language: 'de', theme: 'neon', warmupStrategy: 'wild' });
    const p = migrateProfileV2(bad, null);
    expect(p.settings).toStrictEqual({ ...DEFAULT_PROFILE_SETTINGS });
    expect(p.accountId).toBe('u-1');
    expect(p.name).toBe('Profile');
    expect(p.createdAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('falls back to opts.now, then the epoch, when v2 has no timestamps', () => {
    const bare = v2User({ createdAt: '', updatedAt: '' });
    expect(migrateProfileV2(bare, null, { now: '2026-09-26T00:00:00.000Z' }).createdAt).toBe('2026-09-26T00:00:00.000Z');
    expect(migrateProfileV2(bare, null).updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('is idempotent on v3 input', () => {
    const once = migrateProfileV2(v2User(), 'p-2');
    expect(migrateProfileV2(once, 'ignored')).toBe(once);
  });

  it('turns a family member into a profile with a copy of the owner settings', () => {
    const owner = migrateProfileV2(v2User(), null);
    const kid = migrateFamilyMemberV2({ id: 'fm-1', profileId: 'u-1', name: '', createdAt: '2026-01-05' }, owner.settings, 'p-4');
    expect(kid).toStrictEqual({
      id: 'fm-1',
      name: 'Profile',
      activeProgramId: 'p-4',
      settings: owner.settings,
      createdAt: '2026-01-05',
      updatedAt: '2026-01-05',
    });
    expect(kid.settings.plateSetKg).not.toBe(owner.settings.plateSetKg);
  });
});
