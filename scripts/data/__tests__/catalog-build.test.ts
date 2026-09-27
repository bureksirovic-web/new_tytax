import { describe, expect, it } from 'vitest';
import {
  cleanLegacyName,
  deriveIds,
  isTimeTarget,
  mulberry32,
  noStationCategory,
  noStationKind,
  orderVideos,
  seededSample,
  standardImpact,
  type SourceExercise,
} from '../catalog-lib';
import { decideAttachments, decideStation, nameInfo, nonExerciseReason, STATION_RULES } from '../station-rules';
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

  it('maps free weights and frame work to the app-level stations; stretches, free-standing bodyweight and ambiguous moves stay unmapped', () => {
    expect(station('Dumbbell Bench Press')).toEqual({ stationId: 'FREE_WEIGHT', ruleId: 'free-weight' });
    expect(station('Seated EZ Bar Wrist Curl')).toEqual({ stationId: 'FREE_WEIGHT', ruleId: 'free-weight' });
    expect(station('Pull-Up (Parallel Grip)')).toEqual({ stationId: 'FRAME', ruleId: 'frame' });
    expect(station('Triceps Dip With Legs On Bench')).toEqual({ stationId: 'FRAME', ruleId: 'frame' });
    expect(station('Roman Chair Hyperextension')).toEqual({ stationId: 'FRAME', ruleId: 'frame' });
    expect(station('Incline Sit-Up')).toEqual({ stationId: 'FRAME', ruleId: 'frame-bench' });
    expect(station('Standing Glute Bridge (with Bench)')).toEqual({ stationId: 'FRAME', ruleId: 'frame-bench' });
    // no station by design: stretches (even hanging ones) and free-standing bodyweight
    expect(station('Assisted Hip Flexor Stretching')).toBeUndefined();
    expect(station('Hanging Hamstring Stretch')).toBeUndefined();
    expect(station('Plank')).toBeUndefined();
    expect(station('Standing Glute Bridge')).toBeUndefined();
    expect(station('Sit Up')).toBeUndefined();
    // ambiguous machine move: still unresolved
    expect(station('Lying Curl')).toBeUndefined();
    expect(noStationCategory('Seated EZ Bar Wrist Curl')).toBe('free-weight');
    expect(noStationCategory('Hanging Leg Raise')).toBe('bodyweight-frame');
    expect(noStationCategory('Assisted Leg Stretching')).toBe('stretch');
    expect(noStationCategory('Plank')).toBe('bodyweight');
    expect(noStationCategory('Lying Curl')).toBe('ambiguous');
    expect(noStationKind('stretch')).toBe('by-design');
    expect(noStationKind('bodyweight')).toBe('by-design');
    expect(noStationKind('ambiguous')).toBe('unresolved');
    // a reviewed `stationId: null` hand mapping is unresolved whatever its name family
    expect(noStationKind('stretch', true)).toBe('unresolved');
  });

  it('runs the app-level rules after every machine rule, so machine names keep their machine station', () => {
    expect(STATION_RULES.slice(-3).map((r) => r.id)).toEqual(['free-weight', 'frame', 'frame-bench']);
    expect(STATION_RULES.slice(0, -3).every((r) => r.station !== 'FRAME' && r.station !== 'FREE_WEIGHT')).toBe(true);
    // a Smith/sled/assisted/cable word beats the frame and free-weight words
    expect(station('Smith Machine Barbell Squat')).toEqual({ stationId: 'SMITH', ruleId: 'smith' });
    expect(station('Sled Assisted Chin Up with Belt')).toEqual({ stationId: 'SMITH', ruleId: 'sled' });
    expect(station('Assisted Close Grip Chin-Up')).toEqual({ stationId: 'SMITH', ruleId: 'assisted-bodyweight' });
    expect(station('Cable Hanging Knee Raise')?.stationId).toBe('BACK_LOWER');
  });

  it('assigns attachments only on pulleys (and the belt anywhere)', () => {
    expect(decideAttachments(info('Upper Pulley Rope Triceps Pushdown'), 'BACK_UPPER')).toEqual(['TRICEPS_ROPE']);
    expect(decideAttachments(info('Standing Cable One Arm Side Lateral Raise'), 'BACK_LOWER')).toEqual(['D_HANDLES']);
    expect(decideAttachments(info('Seated V-Bar Pulldown'), 'BACK_UPPER')).toEqual(['V_HANDLE']);
    expect(decideAttachments(info('Smith One Arm Row'), 'SMITH')).toEqual([]);
    expect(decideAttachments(info('Sled Assisted Chin Up with Belt'), 'SMITH')).toEqual(['DIP_BELT']);
  });

  it('recognises promo and overview videos from source metadata, not names', () => {
    // no exerciseLevel and T1-X number ≤ 13 → a video; the name only labels the reason
    expect(nonExerciseReason('Delivery Georgia, USA', 't1x_number=3')?.id).toBe('delivery');
    expect(nonExerciseReason('TYTAXÂ® TX | Folding the bench', 't1x_number=4')?.id).toBe('product-overview');
    expect(nonExerciseReason('Something new', 't1x_number=9')?.id).toBe('video');
    // real app exercises carry an exerciseLevel, even with odd names
    expect(nonExerciseReason('NEvUVCFF8x8', 'exerciseLevel=medium; t1x_number=1590')).toBeUndefined();
    expect(nonExerciseReason('Abs Workout', 'exerciseLevel=easy; t1x_number=198')).toBeUndefined();
    // a specific source station is never a video
    expect(nonExerciseReason('Smith Flat Bench Press', 't1x_number=1', 'Smith Machine')).toBeUndefined();
  });

  it('muscle-region words are not pulley names; pushdowns and supine flies get the right pulley', () => {
    expect(station('Standing Cable Upper Chest Fly')?.stationId).toBe('BACK_LOWER');
    expect(station('Standing Cable Lower Chest Press')?.stationId).toBe('BACK_UPPER');
    expect(station('Cable Pushdown Lower Chest')).toEqual({ stationId: 'BACK_UPPER', ruleId: 'cable-pushdown' });
    expect(station('Lying Cable Fly')).toEqual({ stationId: 'BACK_LOWER', ruleId: 'cable-supine' });
    expect(station('Lying Cable V-Bar Pullover')?.stationId).toBe('BACK_LOWER');
    // loaded from above: prone, reverse, standing
    expect(station('Prone Incline Cable Fly')?.stationId).toBe('BACK_UPPER');
    expect(station('Lying Cable Reverse Fly')?.stationId).toBe('BACK_UPPER');
    expect(station('Cable Standing Decline Chest Fly')?.stationId).toBe('BACK_UPPER');
  });

  it('attachment rules do not misfire on V-handles, triceps kickbacks and single-handle pulldowns', () => {
    expect(decideAttachments(info('Lower Pulley Single-Arm Triceps Kickback', 'Kickback', 'TRICEPS'), 'BACK_LOWER')).toEqual(['D_HANDLES']);
    expect(decideAttachments(info('Upper Pulley Neutral-Grip Lat Pulldown (V-handle)'), 'BACK_UPPER')).toEqual(['V_HANDLE']);
    expect(decideAttachments(info('Upper Pulley Single-Arm Kneeling Lat Pulldown'), 'BACK_UPPER')).toEqual(['D_HANDLES']);
    expect(decideAttachments(info('Seated Separate Cable Lat Pulldown'), 'BACK_UPPER')).toEqual(['D_HANDLES']);
    expect(decideAttachments(info('Upper Pulley Wide-Grip Lat Pulldown'), 'BACK_UPPER')).toEqual(['LAT_BAR']);
    expect(decideAttachments(info('Lower Pulley Cable Glute Kickback (ankle strap)', 'Kickback', 'GLUTES'), 'BACK_LOWER')).toEqual(['ANKLE_STRAP']);
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

  it('recognises pure time targets only', () => {
    for (const t of ['20-40s', '30 sec', '1-2 min', '40s hold', '2-5 min', '15-30s hold', '20-45s/side', ' 10 - 30 seconds', '1 minutes', '45 SECS']) {
      expect([t, isTimeTarget(t)]).toEqual([t, true]);
    }
    for (const t of ['8-12', '8-12 (2s hold)', '8-12 (2s hold)/side', '10-15/side', '5 sets', '12 swings', 'AMRAP', '', 'hold 30s', '3x30s']) {
      expect([t, isTimeTarget(t)]).toEqual([t, false]);
    }
  });

  it('parses the window.TYTAX_MAINFRAME source file', () => {
    expect(parseMainframe('window.TYTAX_MAINFRAME = [{"name":"A"}];')).toEqual([{ name: 'A' }]);
    expect(() => parseMainframe('nothing here')).toThrow(/no array literal/);
  });
});

describe('Wave 2 refuter regressions', () => {
  it('a row "with crunch" stays on the lower pulley without an ab strap', () => {
    const n = info('Bent-Over Cable Reverse Grip Row with Crunch', 'Horizontal Pull', 'BACK_HORIZONTAL');
    expect(decideStation(n)).toEqual({ stationId: 'BACK_LOWER', ruleId: 'cable-from-below' });
    expect(decideAttachments(n, 'BACK_LOWER')).toEqual([]);
    // a plain cable crunch still pulls from above
    expect(station('Kneeling Cable Crunch')?.stationId).toBe('BACK_UPPER');
  });

  it('"reverse grip" does not block the supine rule; a reverse FLY is still loaded from above', () => {
    expect(station('Lying Cable Reverse Grip Pullover')).toEqual({ stationId: 'BACK_LOWER', ruleId: 'cable-supine' });
    expect(station('Lying Cable Reverse Fly')?.stationId).toBe('BACK_UPPER');
  });
});
