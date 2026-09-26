import { describe, expect, it } from 'vitest';
import {
  cleanLegacyName,
  deriveIds,
  mulberry32,
  orderVideos,
  seededSample,
  standardImpact,
  unresolvedCategory,
  type SourceExercise,
} from '../catalog-lib';
import { decideAttachments, decideStation, nameInfo, nonExerciseReason } from '../station-rules';
import { parseMainframe } from '../build-catalog';

const info = (name: string, pattern = 'Other', muscleGroup = 'CHEST') => nameInfo(name, pattern, muscleGroup);
const station = (name: string, pattern?: string, muscleGroup?: string) => decideStation(info(name, pattern, muscleGroup));

describe('station rules', () => {
  it('maps the sled and Smith families to SMITH', () => {
    expect(station('Lying Sled Leg Press')).toEqual({ stationId: 'SMITH', ruleId: 'sled' });
    expect(station('Kneeling Smith Row')).toEqual({ stationId: 'SMITH', ruleId: 'smith' });
    expect(station('Assisted Close Grip Chin-Up')).toEqual({ stationId: 'SMITH', ruleId: 'assisted-bodyweight' });
  });

  it('picks the pulley from the words that name it or the direction of pull', () => {
    expect(station('Standing Low Cable Crossover')?.stationId).toBe('BACK_LOWER');
    expect(station('High Cross Cable Reverse Fly')?.stationId).toBe('BACK_UPPER');
    expect(station('One Arm Triceps Pushdown (Hammer Grip)')).toEqual({ stationId: 'BACK_UPPER', ruleId: 'pull-from-above' });
    expect(station('Standing Cable Hammer Biceps Curl')).toEqual({ stationId: 'BACK_LOWER', ruleId: 'cable-from-below' });
    expect(station('Double Poling')).toEqual({ stationId: 'BACK_UPPER', ruleId: 'ski-poling' });
  });

  it('keeps lever arms on the back station and splits them by direction', () => {
    expect(station('Kneeling Lever Single Arm Side Pulldown (Back Station)')?.stationId).toBe('BACK_UPPER');
    expect(station('Standing Lever Shrug (Station B)')).toEqual({ stationId: 'BACK_LOWER', ruleId: 'lever' });
    expect(decideAttachments(info('Lever Face Pull'), 'BACK_UPPER')).toEqual([]);
  });

  it('uses the leg seats, except for standing cable curls', () => {
    expect(station('Seated Cable Leg Extension')?.stationId).toBe('LEG_EXTENSION');
    expect(station('Lying Leg Curl')?.stationId).toBe('LEG_CURL');
    expect(station('Standing Cable Leg Curl')?.stationId).toBe('BACK_LOWER');
  });

  it('leaves free weights, frame work and stretches unmapped', () => {
    expect(station('Dumbbell Bench Press')).toBeUndefined();
    expect(station('Pull-Up (Parallel Grip)')).toBeUndefined();
    expect(station('Assisted Hip Flexor Stretching')).toBeUndefined();
    expect(unresolvedCategory('Seated EZ Bar Wrist Curl')).toBe('free-weight');
    expect(unresolvedCategory('Hanging Leg Raise')).toBe('bodyweight-frame');
    expect(unresolvedCategory('Assisted Leg Stretching')).toBe('stretch');
    expect(unresolvedCategory('Plank')).toBe('bodyweight');
    expect(unresolvedCategory('Lying Curl')).toBe('ambiguous');
  });

  it('assigns attachments only on pulleys (and the belt anywhere)', () => {
    expect(decideAttachments(info('Upper Pulley Rope Triceps Pushdown'), 'BACK_UPPER')).toEqual(['TRICEPS_ROPE']);
    expect(decideAttachments(info('Standing Cable One Arm Side Lateral Raise'), 'BACK_LOWER')).toEqual(['D_HANDLES']);
    expect(decideAttachments(info('Seated V-Bar Pulldown'), 'BACK_UPPER')).toEqual(['V_HANDLE']);
    expect(decideAttachments(info('Smith One Arm Row'), 'SMITH')).toEqual([]);
    expect(decideAttachments(info('Sled Assisted Chin Up with Belt'), 'SMITH')).toEqual(['DIP_BELT']);
  });

  it('recognises promo and overview videos as non-exercises', () => {
    expect(nonExerciseReason('Delivery Georgia, USA')?.id).toBe('delivery');
    expect(nonExerciseReason('TYTAXÂ® TX | Folding the bench')?.id).toBe('product-overview');
    expect(nonExerciseReason('NEvUVCFF8x8')?.id).toBe('youtube-id');
    // 11 letters but no digit: a real word, not a video id
    expect(nonExerciseReason('Woodchopper')).toBeUndefined();
    expect(nonExerciseReason('Smith Flat Bench Press')).toBeUndefined();
  });
});

describe('catalog build helpers', () => {
  it('derives the original new_tytax ids: 60-char name slug, _n on collision', () => {
    const src = (name: string, st = 'Tytax') => ({ name, station: st }) as SourceExercise;
    const ids = deriveIds([src('Hanging Sit-Up'), src('Hanging Sit Up'), src('Smith Row', 'Smith Machine'), src('Seated Leg Extension', 'Leg Extension Seat')], {});
    expect(ids['Hanging Sit-Up']).toBe('tytax_tytax_hanging-sit-up');
    // "Hanging Sit Up" slugs to the same base, so it gets the _2 suffix
    expect(ids['Hanging Sit Up']).toBe('tytax_tytax_hanging-sit-up_2');
    expect(ids['Smith Row']).toBe('tytax_smith-machine_smith-row');
    expect(ids['Seated Leg Extension']).toBe('tytax_leg-extension_seated-leg-extension');
    const long = deriveIds([src('A'.repeat(80))], {});
    // 'tytax_tytax_' (12 chars) + 60-char slug
    expect(long['A'.repeat(80)]).toHaveLength(72);
    expect(deriveIds([src('X')], { X: 'fixed-id' }).X).toBe('fixed-id');
  });

  it('cleans legacy names like the original app', () => {
    expect(cleanLegacyName('TYTAX T1 | Smith Flat Bench Press')).toBe('Smith Flat Bench Press');
    expect(cleanLegacyName('TYTAX® T1-X | Instruction | Row')).toBe('Row');
  });

  it('orders videos app.tytax, then YouTube, dropping duplicates', () => {
    const v = orderVideos([
      { url: 'https://www.youtube.com/watch?v=a', label: 'YT' },
      { url: 'https://app.tytax.com/x', label: 'App' },
      { url: 'https://www.youtube.com/watch?v=a', label: 'dup' },
      { url: 'https://example.com/v', label: 'Other' },
    ]);
    expect(v.map((x) => x.label)).toEqual(['App', 'YT', 'Other']);
  });

  it('standardises impact names and merges duplicates at the higher score', () => {
    expect(standardImpact([{ m: 'Chest (sternal pec)', s: 95 }, { m: 'Upper Chest (clavicular pec)', s: 60 }, { m: 'Triceps', s: 65 }])).toEqual([
      { muscle: 'Chest', score: 95 },
      { muscle: 'Triceps', score: 65 },
    ]);
  });

  it('draws a deterministic seeded sample', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: `e${String(i).padStart(3, '0')}` }));
    const a = seededSample(items, 50, 42).map((x) => x.id);
    const b = seededSample([...items].reverse(), 50, 42).map((x) => x.id);
    expect(a).toEqual(b);
    // 50 distinct draws
    expect(new Set(a).size).toBe(50);
    expect(seededSample(items, 5, 7)).not.toEqual(seededSample(items, 5, 42));
    const r = mulberry32(42);
    const first = r();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });

  it('parses the window.TYTAX_MAINFRAME source file', () => {
    expect(parseMainframe('window.TYTAX_MAINFRAME = [{"name":"A"}];')).toEqual([{ name: 'A' }]);
    expect(() => parseMainframe('nothing here')).toThrow(/no array literal/);
  });
});
