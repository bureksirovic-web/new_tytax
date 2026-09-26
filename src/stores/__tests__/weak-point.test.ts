import { describe, it, expect } from 'vitest';
import type { EquipmentInventory, SessionExercise } from '@/contracts/domain';
import { impactFor, isAvailable, weakPoint } from '../weak-point';
import { NOW, ex, log, lookupOf, settings } from './g3-helpers';

const bench = ex('bench', [['Chest', 100]]);
// Quads candidates. Only bench was trained (3 days ago) → distribution {Chest: 1};
// the largest target gap is Quads (0.12 − 0 = 0.12; Chest's gap is negative).
const legExt = ex('leg-ext', [['Quads', 100]], { name: 'Leg Extension', stationId: 'LEG_EXTENSION' });
const sissy = ex('sissy', [['QUADRICEPS', 95]], { name: 'Sissy Squat', stationId: 'SMITH' }); // raw name standardises to Quads
const squat = ex('squat', [['Quads', 95], ['Glutes', 80], ['Hamstrings', 40]], { name: 'A Squat', stationId: 'SMITH' });
const lunge = ex('lunge', [['Quads', 85]], { name: 'Lunge', stationId: 'SMITH' }); // below 90: never picked
const bwSquat = ex('bw-squat', [['Quads', 90], ['Glutes', 60]], { name: 'Air Squat', modality: 'bodyweight', requiresEquipment: ['none'] });
const catalogExercises = [bench, legExt, sissy, squat, lunge, bwSquat];
const lookup = lookupOf(catalogExercises);
const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }, { kg: 80, reps: 8 }] }])];
const on = settings({ weakPointInjector: true });

function inv(over: Partial<EquipmentInventory> = {}): EquipmentInventory {
  return { id: 'p1', profileId: 'p1', stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [], createdAt: '', updatedAt: '', ...over };
}

const base = { history, lookup, catalogExercises, sessionExercises: [] as SessionExercise[], settings: on, now: NOW };

describe('weakPoint', () => {
  it('picks the most isolated primary mover of the lagging muscle; ties by name A–Z', () => {
    const pick = weakPoint(base);
    // One-muscle candidates: Leg Extension and Sissy Squat → name order → "Leg Extension".
    expect(pick?.muscle).toBe('Quads');
    expect(pick?.exercise.id).toBe('leg-ext');
    expect(pick?.sets).toBe(2);
    expect(pick?.sessionExercise.sets.map((s) => s.type)).toEqual(['working', 'working']);
    expect(pick?.sessionExercise.exerciseId).toBe('leg-ext');
  });

  it('skips exercises already in the session', () => {
    const inSession = [{ uid: 'u', exerciseId: 'leg-ext', exerciseName: 'x', modality: 'tytax', sets: [] } as SessionExercise];
    expect(weakPoint({ ...base, sessionExercises: inSession })?.exercise.id).toBe('sissy');
  });

  it('filters by inventory: tytax needs its station', () => {
    const smithOnly = inv({ stationIds: ['SMITH'] });
    expect(weakPoint({ ...base, inventory: smithOnly })?.exercise.id).toBe('sissy');
    // No stations but bodyweight gear recorded → tytax excluded, the air squat remains.
    expect(weakPoint({ ...base, inventory: inv({ bodyweightGear: ['pull-up-bar'] }) })?.exercise.id).toBe('bw-squat');
    // Empty inventory means "not set up": everything available.
    expect(weakPoint({ ...base, inventory: inv() })?.exercise.id).toBe('leg-ext');
  });

  it('prefills the two sets from history (no warm-ups)', () => {
    // leg-ext 10 days ago: outside the 7-day distribution window (Quads still lags),
    // but still the prefill source: 40 + 2.5 (RIR 3) = 42.5 for both sets.
    const withLegs = [...history, log(10, [{ exerciseId: 'leg-ext', sets: [{ kg: 40, reps: 12, rir: 3 }] }])];
    const pick = weakPoint({ ...base, history: withLegs });
    expect(pick?.sessionExercise.sets.map((s) => s.kg)).toEqual([42.5, 42.5]);
  });

  it('null when off, not fresh, nothing trained or no candidate', () => {
    expect(weakPoint({ ...base, settings: settings() })).toBeNull();
    const recent = [log(1, [{ exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }] }])];
    expect(weakPoint({ ...base, history: recent })).toBeNull(); // recovering
    expect(weakPoint({ ...base, history: [] })).toBeNull(); // nothing lagging
    expect(weakPoint({ ...base, catalogExercises: [bench, lunge] })).toBeNull();
    // A log older than the 7-day window does not count → nothing trained → null.
    expect(weakPoint({ ...base, history: [log(8, [{ exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }] }])] })).toBeNull();
  });
});

describe('isAvailable / impactFor', () => {
  it('applies the modality rules', () => {
    const kb = ex('kb', [], { modality: 'kettlebell' });
    const dip = ex('dip', [], { modality: 'bodyweight', requiresEquipment: ['dip-station'] });
    const bwT = ex('bwt', [], { modality: 'bodyweight', requiresEquipment: ['tytax', 'kettlebell'] });
    const custom = ex('c', [], { modality: 'custom' });
    const noStation = ex('ns', []);
    const i = inv({ stationIds: ['SMITH'] });
    expect([isAvailable(kb, i), isAvailable(dip, i), isAvailable(bwT, i), isAvailable(custom, i), isAvailable(noStation, i)]).toEqual([false, false, false, true, false]);
    const full = inv({ stationIds: ['SMITH'], kettlebellsKg: [16], bodyweightGear: ['dip-station'] });
    expect([isAvailable(kb, full), isAvailable(dip, full), isAvailable(bwT, full), isAvailable(kb, null)]).toEqual([true, true, true, true]);
    expect(isAvailable(ex('bw', [], { modality: 'bodyweight' }), i)).toBe(true);
  });

  it('impactFor takes the best standardised score', () => {
    expect(impactFor(sissy, 'Quads')).toBe(95);
    expect(impactFor(squat, 'Chest')).toBe(0);
  });
});
