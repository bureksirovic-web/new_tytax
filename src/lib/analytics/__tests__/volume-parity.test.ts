import { describe, it, expect, vi } from 'vitest';
import { computeVolumeParity, getParityLabel } from '../volume-parity';
import type { WorkoutLog } from '@/types/workout';

vi.mock('@/data', () => ({
  findExerciseById: vi.fn((id: string) => {
    const patterns: Record<string, string> = {
      'ex-push': 'Horizontal Push',
      'ex-pull': 'Horizontal Pull',
      'ex-squat': 'Squat',
      'ex-hinge': 'Hinge',
      'ex-carry': 'Carry',
      'ex-core': 'Core',
    };
    if (patterns[id]) {
      return { id, pattern: patterns[id] };
    }
    return undefined;
  }),
}));

function makeLog(
  date: string,
  exercises: Array<{ ref: string; sets: Array<{ kg: number; reps: number }> }>,
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
        done: true,
        timestamp: new Date().toISOString(),
        kg: s.kg,
        reps: s.reps,
      })),
      muscleImpactSnapshot: [],
    })),
    totalVolumeKg: exercises.reduce(
      (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.kg * set.reps, 0),
      0,
    ),
    totalSets: exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('computeVolumeParity', () => {
  it('returns balanced score for equal push/pull/hinge/quad volume', () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [
      makeLog(today, [
        { ref: 'ex-push', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-pull', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-squat', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-hinge', sets: [{ kg: 100, reps: 10 }] },
      ]),
    ];

    const results = computeVolumeParity(logs);
    const push = results.find(r => r.pattern === 'push');
    const pull = results.find(r => r.pattern === 'pull');
    const quad = results.find(r => r.pattern === 'quad');
    const hinge = results.find(r => r.pattern === 'hinge');

    expect(push).toBeDefined();
    expect(pull).toBeDefined();
    expect(quad).toBeDefined();
    expect(hinge).toBeDefined();

    expect(push!.volume).toBe(pull!.volume);
    expect(quad!.volume).toBe(hinge!.volume);
    expect(push!.volume).toBe(quad!.volume);

    expect(push!.status).toBe('balanced');
    expect(pull!.status).toBe('balanced');
    expect(quad!.status).toBe('balanced');
    expect(hinge!.status).toBe('balanced');
  });

  it('returns unbalanced score when one pattern dominates', () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [
      makeLog(today, [
        { ref: 'ex-push', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-push', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-push', sets: [{ kg: 100, reps: 10 }] },
        { ref: 'ex-push', sets: [{ kg: 100, reps: 10 }] },
      ]),
    ];

    const results = computeVolumeParity(logs);
    const push = results.find(r => r.pattern === 'push');
    expect(push).toBeDefined();
    expect(push!.delta).toBeGreaterThan(0);
    expect(push!.status).toBe('overtrained');
  });

  it('returns results for all movement patterns', () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [makeLog(today, [
      { ref: 'ex-push', sets: [{ kg: 50, reps: 5 }] },
    ])];

    const results = computeVolumeParity(logs);
    const patterns = results.map(r => r.pattern);
    expect(patterns).toContain('push');
    expect(patterns).toContain('pull');
    expect(patterns).toContain('quad');
    expect(patterns).toContain('hinge');
    expect(patterns).toContain('carry');
    expect(patterns).toContain('core');
    expect(patterns).toContain('other');
  });

  it('handles empty logs', () => {
    const results = computeVolumeParity([]);
    expect(results).toHaveLength(7);
    results.forEach(r => {
      expect(r.volume).toBe(0);
      expect(r.percentage).toBe(0);
      expect(r.delta).toBe(-r.targetPercentage);
    });
  });
});

describe('getParityLabel', () => {
  it('returns balanced for delta within +/-5', () => {
    expect(getParityLabel(0)).toBe('balanced');
    expect(getParityLabel(5)).toBe('balanced');
    expect(getParityLabel(-5)).toBe('balanced');
    expect(getParityLabel(3)).toBe('balanced');
    expect(getParityLabel(-3)).toBe('balanced');
  });

  it('returns overtrained for delta > 5', () => {
    expect(getParityLabel(6)).toBe('overtrained');
    expect(getParityLabel(20)).toBe('overtrained');
    expect(getParityLabel(50)).toBe('overtrained');
  });

  it('returns undertrained for delta < -5', () => {
    expect(getParityLabel(-6)).toBe('undertrained');
    expect(getParityLabel(-20)).toBe('undertrained');
    expect(getParityLabel(-50)).toBe('undertrained');
  });
});
