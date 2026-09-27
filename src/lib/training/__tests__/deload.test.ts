import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetEntry } from '@/contracts/domain';
import { deload, training } from '../index';

function s(id: string, type: SetEntry['type'], kg: number): SetEntry {
  return { id, type, kg, reps: 8, done: false, ghostKg: kg, ghostReps: 8 };
}
function ex(uid: string, sets: SetEntry[]): SessionExercise {
  return { uid, exerciseId: `e-${uid}`, exerciseName: uid, modality: 'tytax', sets };
}

describe('deload', () => {
  it('drops the last working set and takes 15 % off, warm-ups untouched', () => {
    const input = [ex('a', [s('w1', 'warmup', 40), s('w2', 'warmup', 60), s('1', 'working', 100), s('2', 'working', 100), s('3', 'working', 100)])];
    const [out] = deload(input);
    // 3 working → 2; 100 × 0.85 = 85 → 85/1.25 = 68 → 85
    expect(out.sets.map((x) => [x.id, x.type, x.kg])).toEqual([
      ['w1', 'warmup', 40],
      ['w2', 'warmup', 60],
      ['1', 'working', 85],
      ['2', 'working', 85],
    ]);
    // ghosts keep last session's values
    expect(out.sets[2].ghostKg).toBe(100);
  });

  it('rounds to 1.25 kg by default, or the given increment', () => {
    const input = [ex('a', [s('1', 'working', 72.5), s('2', 'working', 90)])];
    // 72.5 × 0.85 = 61.625 → /1.25 = 49.3 → 49 × 1.25 = 61.25 (the 90 set is the one removed)
    expect(deload(input)[0].sets.map((x) => x.kg)).toEqual([61.25]);
    const three = [ex('a', [s('1', 'working', 90), s('2', 'working', 100), s('3', 'working', 100)])];
    // 90 × 0.85 = 76.5 → /2.5 = 30.6 → 31 × 2.5 = 77.5; 100 × 0.85 = 85 → 34 × 2.5 = 85
    expect(training.deload(three, { roundToKg: 2.5 })[0].sets.map((x) => x.kg)).toEqual([77.5, 85]);
  });

  it('keeps a single working set (min 1) but still reduces it', () => {
    const [out] = deload([ex('a', [s('w', 'warmup', 20), s('1', 'working', 50)])]);
    // 50 × 0.85 = 42.5 → /1.25 = 34 → 42.5
    expect(out.sets.map((x) => x.kg)).toEqual([20, 42.5]);
    expect(deload([ex('b', [])])[0].sets).toEqual([]);
  });

  it('removes the positionally last non-warm-up set (drop/failure count as working)', () => {
    const [out] = deload([ex('a', [s('1', 'working', 100), s('2', 'working', 100), s('d', 'drop', 80)])]);
    // drop set is last → removed; 100 × 0.85 = 85
    expect(out.sets.map((x) => [x.id, x.kg])).toEqual([
      ['1', 85],
      ['2', 85],
    ]);
  });

  it('never mutates its input and handles exercises independently', () => {
    const input = [ex('a', [s('1', 'working', 100), s('2', 'working', 100)]), ex('b', [s('3', 'working', 40)])];
    const snapshot = structuredClone(input);
    const out = deload(input);
    expect(input).toEqual(snapshot);
    expect(out[0]).not.toBe(input[0]);
    expect(out[0].sets[0]).not.toBe(input[0].sets[0]);
    // a: 2 → 1 set at 85; b: 1 set, 40 × 0.85 = 34 → /1.25 = 27.2 → 27 × 1.25 = 33.75
    expect(out.map((e) => e.sets.map((x) => x.kg))).toEqual([[85], [33.75]]);
  });
});
