import { describe, expect, it } from 'vitest';
import type { LegacyWorkoutLogV2 } from '@/contracts/domain';
import { readLegacyDeviceSettings } from '../device';
import { migrateLogV2, migrateSnapshotV2toV3 } from '../index';
import { stableUuid } from '../stable-id';
import { CTX, v2Log, v2User } from './fixture';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function emptyV2Log(): LegacyWorkoutLogV2 {
  const log: LegacyWorkoutLogV2 = {
    ...v2Log(),
    exercises: [],
    modalitiesUsed: ['TYTAX'],
    finishedAt: '2026-03-01T11:00:00.000Z',
    updatedAt: '2026-03-01T11:00:00.000Z',
  };
  delete log.familyMemberId;
  return log;
}

describe('v2 log with no exercises and no familyMemberId key (looks v3)', () => {
  it('gets lower-case modalities and zero totals', () => {
    const [out] = migrateSnapshotV2toV3({ workoutLogs: [emptyV2Log()] }, CTX).tables.workoutLogs;
    expect(out.modalitiesUsed).toEqual(['tytax']);
    expect({ v: out.totalVolumeKg, s: out.totalSets, p: out.prCount }).toEqual({ v: 0, s: 0, p: 0 });
  });

  it('is idempotent, and a real v3 log comes back as the same object', () => {
    const once = migrateLogV2(emptyV2Log(), CTX);
    const twice = migrateLogV2(once, CTX);
    expect(twice).toBe(once);
    const v3 = migrateLogV2(v2Log(), CTX);
    expect(migrateLogV2(v3, CTX)).toBe(v3);
  });
});

describe('stableUuid', () => {
  it('is deterministic, uuid-v4 shaped, and separates owners and part boundaries', () => {
    const a = stableUuid('arsenal', 'u-1', 'bench');
    expect(a).toMatch(UUID_V4);
    expect(stableUuid('arsenal', 'u-1', 'bench')).toBe(a);
    expect(stableUuid('arsenal', 'u-2', 'bench')).not.toBe(a);
    expect(stableUuid('ab', 'c')).not.toBe(stableUuid('a', 'bc'));
  });
});

describe('arsenal migration', () => {
  it('re-running on its output changes nothing and keeps one row per owner + exercise', () => {
    const snapshot = {
      profiles: [v2User()],
      arsenal: [{ id: 'bench', profileId: 'local', addedAt: '2026-02-01' }],
    };
    const first = migrateSnapshotV2toV3(snapshot, CTX).tables;
    expect(first.arsenal.map((a) => [a.id, a.exerciseId])).toEqual([[stableUuid('arsenal', 'u-1', 'bench'), 'bench']]);
    const second = migrateSnapshotV2toV3({ profiles: first.profiles, arsenal: [...first.arsenal, ...first.arsenal] }, CTX).tables;
    expect(second.arsenal).toStrictEqual(first.arsenal);
  });

  it('an existing v3 row for the same owner + exercise wins over a freshly migrated v2 row', () => {
    const v3Row = { id: '11111111-1111-4111-8111-111111111111', profileId: 'u-1', exerciseId: 'bench', addedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const { arsenal } = migrateSnapshotV2toV3(
      { profiles: [v2User()], arsenal: [{ id: 'bench', profileId: 'u-1', addedAt: '2026-02-01' }, v3Row] },
      CTX,
    ).tables;
    expect(arsenal).toStrictEqual([v3Row]);
  });
});

describe('readLegacyDeviceSettings', () => {
  const store = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null });

  it('maps v2 values to v3 settings and fills v2 UI defaults', () => {
    expect(readLegacyDeviceSettings(store({ units: 'imperial', locale: 'hr', theme: 'oled' }))).toEqual({ units: 'lb', language: 'hr', theme: 'oled' });
    expect(readLegacyDeviceSettings(store({}))).toEqual({ units: 'kg', language: 'en', theme: 'tactical' });
  });

  it('is undefined when storage is missing or throws', () => {
    expect(readLegacyDeviceSettings(undefined)).toBeUndefined();
    const broken = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
    };
    expect(readLegacyDeviceSettings(broken)).toBeUndefined();
  });
});
