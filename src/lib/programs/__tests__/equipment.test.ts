import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import {
  DEFAULT_OWNED_ATTACHMENTS,
  LIBRARY_DEFAULT_OWNED_ATTACHMENTS,
  defaultOwnedAttachments,
  ownershipFrom,
  ownsExercise,
  ownsRequiredAttachment,
  requiredAttachments,
  requiredGearOf,
  stationIdOf,
  type InventoryLike,
} from '../equipment';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8', impact: [], ...over };
}

describe('requiredAttachments / requiredGearOf / stationIdOf', () => {
  it('returns the catalog attachmentIds, deduplicated, as a new array', () => {
    const rope = ex('rope-pushdown', { attachmentIds: ['TRICEPS_ROPE', 'TRICEPS_ROPE'] });
    expect(requiredAttachments(rope)).toEqual(['TRICEPS_ROPE']);
    expect(requiredAttachments(ex('bench'))).toEqual([]);
    const ids = ['LAT_BAR'];
    expect(requiredAttachments({ attachmentIds: ids })).not.toBe(ids);
  });

  it('derives gear from requiresEquipment, adding a kettlebell for KB exercises', () => {
    expect(requiredGearOf(ex('pullup', { modality: 'bodyweight', requiresEquipment: ['pull-up-bar', 'none'] }))).toEqual(['pull-up-bar']);
    expect(requiredGearOf(ex('swing', { modality: 'kettlebell' }))).toEqual(['kettlebell']);
    expect(requiredGearOf(ex('bench', { requiresEquipment: ['tytax'] }))).toEqual([]);
  });

  it('resolves the station by id, then display name (exact, then prefix)', () => {
    const stations = [{ id: 'SMITH', name: 'Smith Machine' }, { id: 'BACK_UPPER', name: 'Back Upper Pulley' }];
    expect(stationIdOf(ex('a', { stationId: 'LEG_CURL', station: 'Smith Machine' }), stations)).toBe('LEG_CURL');
    expect(stationIdOf(ex('b', { station: 'smith machine' }), stations)).toBe('SMITH');
    expect(stationIdOf(ex('c', { station: 'Back Upper' }), stations)).toBe('BACK_UPPER');
    expect(stationIdOf(ex('d'), stations)).toBeUndefined();
  });
});

describe('ownership (G4 semantics)', () => {
  it('defaults to the catalog\'s "Owned" attachments, else the pre-library defaults', () => {
    const library = [
      { id: 'LAT_BAR', name: 'Lat bar', priority: 'Owned' },
      { id: 'EZ_LAT_BAR', name: 'EZ/angled lat bar', priority: 'Owned' },
      { id: 'TRICEPS_ROPE', name: 'Triceps rope', priority: 'High' },
    ];
    expect(defaultOwnedAttachments(library)).toEqual(['LAT_BAR', 'EZ_LAT_BAR']);
    const own = ownershipFrom(undefined, defaultOwnedAttachments(library));
    expect(ownsExercise(['LAT_BAR'], 'SMITH', own)).toBe(true);
    expect(ownsExercise(['TRICEPS_ROPE'], 'SMITH', own)).toBe(false);
    // a catalog with priorities but none owned owns nothing by default
    expect(defaultOwnedAttachments([{ id: 'X', name: 'X', priority: 'High' }])).toEqual([]);
    // pre-library catalog (no priority): the legacy defaults that exist in it
    expect(defaultOwnedAttachments([{ id: 'rope', name: 'Rope' }, { id: 'lat-bar', name: 'Lat bar' }])).toEqual(['lat-bar']);
    expect(ownershipFrom(undefined).attachmentIds).toEqual(new Set(DEFAULT_OWNED_ATTACHMENTS));
  });

  it('respects a stored inventory (attachments and stations)', () => {
    const own = ownershipFrom({ attachmentIds: ['rope'], stationIds: ['smith'] });
    expect(ownsExercise(['rope'], 'smith', own)).toBe(true);
    expect(ownsExercise(['lat-bar'], 'smith', own)).toBe(false); // defaults do not apply once set up
    expect(ownsExercise([], 'back-upper', own)).toBe(false);
    expect(ownsExercise([], undefined, own)).toBe(true);
  });

  describe('bodyweight gear and kettlebells (Settings > Equipment)', () => {
    const bw = (id: string, over: Partial<Exercise> = {}) => ex(id, { modality: 'bodyweight', ...over });
    const ALL = [
      bw('pullup', { requiresEquipment: ['pull-up-bar'] }),
      bw('dip', { requiresEquipment: ['dip-station'] }),
      bw('pushup', { requiresEquipment: ['none'] }),
      bw('swing', { modality: 'kettlebell' }),
    ];
    const owned = (inv: InventoryLike | undefined) => {
      const own = ownershipFrom(inv);
      return ALL.filter((e) => ownsExercise(requiredAttachments(e), stationIdOf(e, []), own, requiredGearOf(e))).map((e) => e.id);
    };

    it('hides exercises needing gear or kettlebells the configured inventory lacks', () => {
      expect(owned({ attachmentIds: ['lat-bar'], stationIds: [], bodyweightGear: [], kettlebellsKg: [] })).toEqual(['pushup']);
    });

    it('shows them once the gear / a kettlebell is owned', () => {
      expect(owned({ attachmentIds: ['lat-bar'], stationIds: [], bodyweightGear: ['pull-up-bar'], kettlebellsKg: [16] })).toEqual(['pullup', 'pushup', 'swing']);
    });

    it('an inventory with only gear set counts as configured; a fully empty one restricts nothing', () => {
      expect(owned({ attachmentIds: [], stationIds: [], bodyweightGear: ['dip-station'], kettlebellsKg: [] })).toEqual(['dip', 'pushup']);
      expect(owned({ attachmentIds: [], stationIds: [], bodyweightGear: [], kettlebellsKg: [] })).toEqual(['pullup', 'dip', 'pushup', 'swing']);
      expect(owned(undefined)).toEqual(['pullup', 'dip', 'pushup', 'swing']);
    });
  });
});

describe('ownsRequiredAttachment (G4-16)', () => {
  const ROPE = ex('rope-pushdown', { attachmentIds: ['TRICEPS_ROPE'] });
  const LAT = ex('lat-pulldown', { attachmentIds: ['LAT_BAR'] });
  const BENCH = ex('bench');

  it('an unconfigured inventory owns the shipped library defaults', () => {
    expect([...LIBRARY_DEFAULT_OWNED_ATTACHMENTS]).toEqual(['LAT_BAR', 'EZ_LAT_BAR']); // priority "Owned" in library.json
    expect(ownsRequiredAttachment(LAT, undefined)).toBe(true);
    expect(ownsRequiredAttachment(ROPE, undefined)).toBe(false);
    const empty: InventoryLike = { attachmentIds: [], stationIds: [], bodyweightGear: [], kettlebellsKg: [] };
    expect(ownsRequiredAttachment(LAT, empty)).toBe(true);
    expect(ownsRequiredAttachment(LAT, undefined, [])).toBe(false); // caller-supplied defaults win
  });

  it('a configured inventory owns exactly its attachments; none needed always passes', () => {
    const inv: InventoryLike = { attachmentIds: ['TRICEPS_ROPE'], stationIds: [] };
    expect(ownsRequiredAttachment(ROPE, inv)).toBe(true);
    expect(ownsRequiredAttachment(LAT, inv)).toBe(false);
    expect(ownsRequiredAttachment(BENCH, inv)).toBe(true);
    expect(ownsRequiredAttachment(ex('both', { attachmentIds: ['TRICEPS_ROPE', 'LAT_BAR'] }), inv)).toBe(false);
  });
});
