import { describe, it, expect } from 'vitest';
import { getE1RMProgression, getBestLifts } from '../pr-tracker';
import type { WorkoutLog } from '@/types/workout';

function makeLog(
  date: string,
  exercises: Array<{
    ref: string;
    sets: Array<{ kg: number; reps: number; done: boolean }>;
  }>,
): WorkoutLog {
  return {
    id: `log-${date}`,
    profileId: 'test',
    sessionName: 'Test',
    date,
    startedAt: new Date().toISOString(),
    durationSeconds: 3600,
    exercises: exercises.map((ex, i) => ({
      exerciseRef: ex.ref,
      exerciseName: `Exercise ${i}`,
      modality: 'tytax',
      sets: ex.sets.map((s, si) => ({
        id: `s-${i}-${si}`,
        setNumber: si + 1,
        type: 'working' as const,
        done: s.done,
        timestamp: new Date().toISOString(),
        kg: s.kg,
        reps: s.reps,
      })),
      muscleImpactSnapshot: [],
    })),
    totalVolumeKg: 0,
    totalSets: 0,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('getE1RMProgression', () => {
  it('tracks best e1RM per exercise per day', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
      ]),
      makeLog('2024-01-02', [
        { ref: 'ex1', sets: [{ kg: 105, reps: 5, done: true }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-02');
    expect(result[1].e1rm).toBeGreaterThan(result[0].e1rm);
  });

  it('ignores incomplete sets (reps=0)', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 0, done: true }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');
    expect(result).toHaveLength(0);
  });

  it('ignores incomplete sets (kg=0)', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 0, reps: 5, done: true }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');
    expect(result).toHaveLength(0);
  });

  it('ignores incomplete sets (done=false)', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: false }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');
    expect(result).toHaveLength(0);
  });

  it('returns chronologically sorted results', () => {
    const logs = [
      makeLog('2024-01-05', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
      ]),
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 90, reps: 5, done: true }] },
      ]),
      makeLog('2024-01-03', [
        { ref: 'ex1', sets: [{ kg: 95, reps: 5, done: true }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-03');
    expect(result[2].date).toBe('2024-01-05');
  });

  it('picks the best e1RM for a day with multiple sets', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          ref: 'ex1',
          sets: [
            { kg: 80, reps: 8, done: true },
            { kg: 100, reps: 5, done: true },
            { kg: 90, reps: 6, done: true },
          ],
        },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex1');

    expect(result).toHaveLength(1);
    expect(result[0].weight).toBe(100);
    expect(result[0].reps).toBe(5);
  });

  it('returns empty array for no matching exercise', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
      ]),
    ];

    const result = getE1RMProgression(logs, 'ex2');
    expect(result).toHaveLength(0);
  });
});

describe('getBestLifts', () => {
  it('returns best lifts across all exercises', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
        { ref: 'ex2', sets: [{ kg: 80, reps: 8, done: true }] },
      ]),
    ];

    const result = getBestLifts(logs);

    expect(result['ex1']).toBeDefined();
    expect(result['ex2']).toBeDefined();
    expect(result['ex1'].weight).toBe(100);
    expect(result['ex2'].weight).toBe(80);
  });

  it('ignores incomplete sets', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          ref: 'ex1',
          sets: [
            { kg: 0, reps: 5, done: true },
            { kg: 100, reps: 0, done: true },
            { kg: 100, reps: 5, done: false },
          ],
        },
      ]),
    ];

    const result = getBestLifts(logs);
    expect(result['ex1']).toBeUndefined();
  });

  it('tracks best e1RM across multiple days', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
      ]),
      makeLog('2024-01-05', [
        { ref: 'ex1', sets: [{ kg: 90, reps: 8, done: true }] },
      ]),
    ];

    const result = getBestLifts(logs);

    const brzycki = (w: number, r: number) => w / (1.0278 - 0.0278 * r);
    const e1rm1 = brzycki(100, 5);
    const e1rm2 = brzycki(90, 8);

    expect(result['ex1'].e1rm).toBe(Math.max(e1rm1, e1rm2));
  });

  it('includes date of best lift', () => {
    const logs = [
      makeLog('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5, done: true }] },
      ]),
    ];

    const result = getBestLifts(logs);
    expect(result['ex1'].date).toBe('2024-01-01');
  });
});
