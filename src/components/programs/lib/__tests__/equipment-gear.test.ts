import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import { ownershipFrom } from '@/lib/programs/equipment';
import { DEFAULT_SLOT_FILTER, filterSlotExercises } from '../slot-filter';

function bw(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'bodyweight', muscleGroup: 'BACK_VERTICAL', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8', impact: [], ...over };
}

const PULLUP = bw('pullup', { requiresEquipment: ['pull-up-bar'] });
const DIP = bw('dip', { muscleGroup: 'TRICEPS', requiresEquipment: ['dip-station'] });
const PUSHUP = bw('pushup', { muscleGroup: 'CHEST', requiresEquipment: ['none'] });
const SWING = bw('swing', { modality: 'kettlebell', muscleGroup: 'GLUTES' });
const ALL = [PULLUP, DIP, PUSHUP, SWING];

const base = { ...DEFAULT_SLOT_FILTER, modality: 'all' as const, ownedOnly: true };
function ids(inv: Parameters<typeof ownershipFrom>[0]) {
  const ctx = { kind: null, stations: [], own: ownershipFrom(inv), favourites: new Set<string>(), requiredAttachments: () => [] };
  return filterSlotExercises(ALL, base, ctx).map((e) => e.id);
}

describe('owned-only filter: bodyweight gear and kettlebells (Settings > Equipment)', () => {
  it('hides exercises needing gear or kettlebells the configured inventory lacks', () => {
    expect(ids({ attachmentIds: ['lat-bar'], stationIds: [], bodyweightGear: [], kettlebellsKg: [] })).toEqual(['pushup']);
  });

  it('shows them once the gear / a kettlebell is owned', () => {
    expect(ids({ attachmentIds: ['lat-bar'], stationIds: [], bodyweightGear: ['pull-up-bar'], kettlebellsKg: [16] })).toEqual(['pullup', 'pushup', 'swing']);
  });

  it('an inventory with only gear set counts as configured; a fully empty one restricts nothing', () => {
    expect(ids({ attachmentIds: [], stationIds: [], bodyweightGear: ['dip-station'], kettlebellsKg: [] })).toEqual(['dip', 'pushup']);
    expect(ids({ attachmentIds: [], stationIds: [], bodyweightGear: [], kettlebellsKg: [] })).toEqual(['pullup', 'dip', 'pushup', 'swing']);
    expect(ids(undefined)).toEqual(['pullup', 'dip', 'pushup', 'swing']);
  });
});
