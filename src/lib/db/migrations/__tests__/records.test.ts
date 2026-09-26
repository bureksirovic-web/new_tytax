import { describe, expect, it } from 'vitest';
import { clampIndex, compact, finiteOr, toModality } from '../coerce';
import { migrateArsenalV2, migrateBodyweightV2, migrateEquipmentV2, migrateNoteV2, migratePRRecordV2 } from '../records';
import type { LegacyEquipmentProfileV2, LegacyPRRecordV2 } from '../types';

const pr = (over: Partial<LegacyPRRecordV2>): LegacyPRRecordV2 => ({
  id: 'pr',
  profileId: 'local',
  exerciseId: 'bench',
  exerciseName: 'Bench',
  prType: 'weight',
  value: 100,
  achievedAt: '2026-03-01',
  workoutLogId: 'log-1',
  ...over,
});

describe('migratePRRecordV2', () => {
  it('recovers kg and reps by PR type', () => {
    expect(migratePRRecordV2(pr({ prType: 'weight', value: 100, reps: 3 }), 'u').kg).toBe(100);
    expect(migratePRRecordV2(pr({ prType: 'volume', value: 400, reps: 0 }), 'u').kg).toBe(0);
    const reps = migratePRRecordV2(pr({ prType: 'reps', value: 12 }), 'u');
    expect([reps.kg, reps.reps]).toEqual([0, 12]);
    const e1rm = migratePRRecordV2(pr({ prType: 'e1rm', value: Number.NaN }), 'u');
    expect([e1rm.value, e1rm.kg, e1rm.reps]).toEqual([0, 0, 0]);
  });

  it('returns v3 rows unchanged', () => {
    const once = migratePRRecordV2(pr({}), 'u');
    expect(migratePRRecordV2(once, 'other')).toBe(once);
  });
});

describe('small tables are idempotent', () => {
  it('bodyweight, notes, arsenal', () => {
    const bw = migrateBodyweightV2({ id: 'b', profileId: 'local', date: '2026-03-01', valueKg: 80, createdAt: 't' }, 'u');
    expect(migrateBodyweightV2(bw, 'x')).toBe(bw);
    const n = migrateNoteV2({ id: 'n', profileId: 'local', exerciseId: 'e', content: 'c', updatedAt: 't' }, 'u');
    expect(migrateNoteV2(n, 'x')).toBe(n);
    const a = migrateArsenalV2({ id: 'e', profileId: 'local', addedAt: 't' }, 'u');
    expect(migrateArsenalV2(a, 'x')).toBe(a);
  });
});

describe('migrateEquipmentV2', () => {
  it('drops non-numeric weights and non-string attachments; no kettlebells, no kettlebell gear', () => {
    const eq = {
      id: 'eq',
      profileId: 'local',
      name: 'x',
      hasSmithMachine: false,
      hasUpperPulley: false,
      hasLowerPulley: true,
      hasLegExtension: true,
      hasLegCurl: false,
      attachments: ['rope', 7],
      hasPullUpBar: false,
      hasDipStation: true,
      hasRings: false,
      hasParallettes: true,
      kettlebellWeights: 'none',
      plateWeights: [],
      barWeightKg: 20,
    } as unknown as LegacyEquipmentProfileV2;
    const inv = migrateEquipmentV2(eq, 'u', 'now');
    expect(inv.stationIds).toEqual(['BACK_LOWER', 'LEG_EXTENSION']);
    expect(inv.attachmentIds).toEqual(['rope']);
    expect(inv.kettlebellsKg).toEqual([]);
    expect(inv.bodyweightGear).toEqual(['dip-station', 'parallettes']);
    const noAttachments = migrateEquipmentV2({ ...eq, attachments: undefined } as unknown as LegacyEquipmentProfileV2, 'u', 'now');
    expect(noAttachments.attachmentIds).toEqual([]);
  });
});

describe('coerce helpers', () => {
  it('toModality, finiteOr, clampIndex, compact', () => {
    expect(toModality(42)).toBe('custom');
    expect(toModality(' TYTAX ')).toBe('tytax');
    expect(finiteOr('3', 1)).toBe(1);
    expect(clampIndex(2.9, 5)).toBe(2);
    expect(clampIndex(Number.NaN, 5)).toBe(0);
    expect(compact({ a: 1, b: undefined })).toStrictEqual({ a: 1 });
  });
});
