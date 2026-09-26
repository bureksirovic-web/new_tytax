import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetEntry } from '@/contracts/domain';
import { detectPRs, training } from '../index';

let n = 0;
function set(kg: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  n += 1;
  return { id: `s${n}`, type: 'working', kg, reps, done: true, ...extra };
}
function exercise(exerciseId: string, sets: SetEntry[], uid = `u-${exerciseId}`): SessionExercise {
  return { uid, exerciseId, exerciseName: exerciseId.toUpperCase(), modality: 'tytax', sets };
}

describe('detectPRs', () => {
  it('first ever values are baselines (previousBest null)', () => {
    const top = set(100, 5);
    const prs = detectPRs([exercise('press', [top])], {});
    // e1rm: 100*36/(37-5) = 112.5; weight: 100
    expect(prs).toHaveLength(2);
    expect(prs.find((p) => p.prType === 'e1rm')).toMatchObject({ value: 112.5, isBaseline: true, previousBest: null, setId: top.id });
    expect(prs.find((p) => p.prType === 'weight')).toMatchObject({ value: 100, kg: 100, reps: 5, isBaseline: true });
    expect(prs[0].exerciseName).toBe('PRESS');
    expect(prs[0].sessionExerciseUid).toBe('u-press');
  });

  it('strictly greater than the stored best only', () => {
    const prs = detectPRs([exercise('press', [set(100, 5)])], { press: { e1rm: 110, weight: 100 } });
    // e1rm 112.5 > 110 → PR; weight 100 is not > 100 → none
    expect(prs.map((p) => p.prType)).toEqual(['e1rm']);
    expect(prs[0]).toMatchObject({ value: 112.5, previousBest: 110, isBaseline: false });
    // equal e1rm (112.5 vs 112.5) → none
    expect(detectPRs([exercise('press', [set(100, 5)])], { press: { e1rm: 112.5, weight: 120 } })).toEqual([]);
  });

  it('warm-ups and undone sets never count', () => {
    const sets = [set(140, 1, { type: 'warmup' }), set(150, 1, { done: false }), set(60, 10)];
    const prs = detectPRs([exercise('press', sets)], { press: { e1rm: 70, weight: 50 } });
    // only 60×10 counts: e1rm 60*36/27 = 80 > 70; weight 60 > 50
    expect(prs.find((p) => p.prType === 'e1rm')?.value).toBe(80);
    expect(prs.find((p) => p.prType === 'weight')?.value).toBe(60);
    expect(prs.every((p) => p.kg === 60)).toBe(true);
  });

  it('picks the best set per type; drop/failure sets count; ties keep the earlier set', () => {
    const a = set(100, 5);
    const b = set(105, 3);
    const c = set(105, 3);
    const d = set(80, 12, { type: 'failure' });
    const prs = training.detectPRs([exercise('press', [a, b, c, d])], { press: { e1rm: 100, weight: 100 } });
    // e1rm: a 112.5; b,c 105*36/34 = 111.176… → 111.18; d 80*36/25 = 115.2 → best is d (failure set)
    expect(prs.find((p) => p.prType === 'e1rm')).toMatchObject({ value: 115.2, setId: d.id });
    // weight: 105 from b (c ties and is later)
    expect(prs.find((p) => p.prType === 'weight')).toMatchObject({ value: 105, setId: b.id });
  });

  it('rounds e1rm to 0.01 kg and keeps exercises apart, even across occurrences', () => {
    const prs = detectPRs(
      [exercise('press', [set(105, 3)], 'u1'), exercise('curl', [set(20, 10)]), exercise('press', [set(107.5, 3)], 'u2')],
      { press: { e1rm: 200, weight: 106 }, curl: { e1rm: 10, weight: 10 } },
    );
    // press weight: 107.5 (occurrence u2) > 106; press e1rm 107.5*36/34 = 113.82… < 200 → none
    expect(prs.filter((p) => p.exerciseId === 'press').map((p) => [p.prType, p.value, p.sessionExerciseUid])).toEqual([
      ['weight', 107.5, 'u2'],
    ]);
    // curl e1rm: 20*36/27 = 26.666… → 26.67
    expect(prs.find((p) => p.exerciseId === 'curl' && p.prType === 'e1rm')?.value).toBe(26.67);
  });

  it('ignores zero-weight and zero-rep sets and prototype-named ids', () => {
    expect(detectPRs([exercise('press', [set(0, 10), set(50, 0)])], {})).toEqual([]);
    const prs = detectPRs([exercise('constructor', [set(10, 1)])], {});
    // 1 rep → e1rm = kg = 10; baseline because no stored best
    expect(prs.map((p) => [p.prType, p.value, p.isBaseline])).toEqual([
      ['e1rm', 10, true],
      ['weight', 10, true],
    ]);
  });
});
