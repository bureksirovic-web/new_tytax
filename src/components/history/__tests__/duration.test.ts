import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetEntry } from '@/contracts/domain';
import { MAX_DURATION_SECONDS, formatClock, isTimeSet, parseClock } from '../duration';
import { fromLog, newSet, toPatch, validate } from '../edit-model';
import { exerciseHoldSeconds, exerciseVolumeKg, logHoldSeconds } from '../log-math';

const set = (p: Partial<SetEntry>): SetEntry => ({ id: String(Math.random()), type: 'working', kg: 0, reps: 0, done: true, ...p });
const ex = (sets: SetEntry[]): SessionExercise => ({ uid: 'u', exerciseId: 'x', exerciseName: 'X', modality: 'tytax', sets });

describe('duration helpers', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(45)).toBe('00:45');
    expect(formatClock(90)).toBe('01:30');
    expect(formatClock(MAX_DURATION_SECONDS)).toBe('99:59');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(Number.NaN)).toBe('00:00');
  });

  it('parses m:ss, mm:ss and plain seconds; rejects the rest', () => {
    expect(parseClock('1:30')).toBe(90);
    expect(parseClock(' 01:05 ')).toBe(65);
    expect(parseClock('45')).toBe(45);
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('1:5')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock('-3')).toBeNull();
    expect(parseClock('1.5')).toBeNull();
  });

  it('a set is a time set only when it carries a finite duration', () => {
    expect(isTimeSet(set({ durationSeconds: 0 }))).toBe(true);
    expect(isTimeSet(set({}))).toBe(false);
    expect(isTimeSet(set({ durationSeconds: Number.NaN }))).toBe(false);
  });

  it('keeps time sets out of kg volume and sums done working holds', () => {
    // weighted carry 20 kg × 1 for 30 s is a time set: excluded; 10 × 10 = 100 kg counts
    const mixed = ex([
      set({ kg: 20, reps: 1, durationSeconds: 30 }),
      set({ kg: 10, reps: 10 }),
      set({ durationSeconds: 40, type: 'warmup' }),
      set({ durationSeconds: 50, done: false }),
      set({ durationSeconds: 15 }),
    ]);
    expect(exerciseVolumeKg(mixed)).toBe(100);
    expect(exerciseHoldSeconds(mixed)).toBe(45); // 30 + 15
    expect(logHoldSeconds({ exercises: [mixed, ex([set({ durationSeconds: 60 })])] })).toBe(105);
  });
});

describe('edit model: time sets', () => {
  const log = {
    id: 'l1', profileId: 'p1', sessionName: 'Carry', date: '2026-09-15', startedAt: '2026-09-15T08:00:00.000Z',
    finishedAt: '2026-09-15T08:30:00.000Z', durationSeconds: 1800, totalVolumeKg: 0, totalSets: 2, prCount: 1,
    modalitiesUsed: [], createdAt: '2026-09-15T08:30:00.000Z', updatedAt: '2026-09-15T08:30:00.000Z',
    exercises: [ex([set({ id: 'a', kg: 20, reps: 1, durationSeconds: 30, isPR: true }), set({ id: 'b', kg: 20, reps: 1, durationSeconds: 45, isPR: true })])],
  } as const;

  it('edits duration only: kg/reps kept, no e1RM, isPR kept only when the duration is unchanged', () => {
    const draft = fromLog(structuredClone(log) as never, 'kg');
    expect(draft.exercises[0].sets.map((s) => s.duration)).toEqual(['00:30', '00:45']);
    draft.exercises[0].sets[1].duration = '1:00';
    draft.exercises[0].sets.push(newSet(draft.exercises[0], 'c'));
    expect(validate(draft, 'kg').sets).toEqual({});
    const [a, b, c] = toPatch(draft, 'kg').exercises[0].sets;
    expect(a).toMatchObject({ kg: 20, reps: 1, durationSeconds: 30, isPR: true });
    expect(b).toMatchObject({ kg: 20, reps: 1, durationSeconds: 60 });
    expect(b.isPR).toBeUndefined();
    // the added set copies its neighbour: 20 kg × 1, 01:00
    expect(c).toMatchObject({ kg: 20, reps: 1, durationSeconds: 60, done: true });
    expect([a, b, c].map((s) => s.e1rm)).toEqual([undefined, undefined, undefined]);
  });

  it('flags a clock above 99:59 or not a clock', () => {
    const draft = fromLog(structuredClone(log) as never, 'kg');
    draft.exercises[0].sets[0].duration = '6000';
    draft.exercises[0].sets[1].duration = 'abc';
    expect(validate(draft, 'kg').sets).toEqual({ a: { duration: true }, b: { duration: true } });
  });
});
