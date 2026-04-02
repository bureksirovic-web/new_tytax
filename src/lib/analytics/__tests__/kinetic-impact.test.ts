import { describe, it, expect } from 'vitest';
import { computeKineticImpact } from '../kinetic-impact';
import type { WorkoutLog } from '@/types/workout';

function makeLog(date: string, volumeKg: number, exerciseRef = 'test_ex'): WorkoutLog {
  return {
    id: `log-${date}`,
    profileId: 'test',
    sessionName: 'Test',
    date,
    startedAt: new Date().toISOString(),
    durationSeconds: 3600,
    exercises: [{
      exerciseRef,
      exerciseName: 'Test Exercise',
      modality: 'tytax',
      sets: [{
        id: 's1',
        setNumber: 1,
        type: 'working',
        done: true,
        timestamp: new Date().toISOString(),
        kg: volumeKg,
        reps: 1,
      }],
      muscleImpactSnapshot: [],
    }],
    totalVolumeKg: volumeKg,
    totalSets: 1,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('computeKineticImpact', () => {
  it('returns 0 for empty logs', () => {
    const result = computeKineticImpact([]);
    expect(result.score).toBe(0);
    expect(result.label).toBe('poor');
    expect(result.components.acwrScore).toBe(0);
    expect(result.components.parityScore).toBe(0);
    expect(result.components.consistencyScore).toBe(0);
    expect(result.components.volumeScore).toBe(0);
  });

  it('returns 0 for null logs', () => {
    const result = computeKineticImpact(null as any);
    expect(result.score).toBe(0);
    expect(result.label).toBe('poor');
  });

  it('returns a score between 0-100 for valid logs', () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [makeLog(today, 1000)];
    const result = computeKineticImpact(logs);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('higher volume roughly yields higher score', () => {
    const baseDate = new Date();
    const logs1: WorkoutLog[] = [];
    const logs2: WorkoutLog[] = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i * 2);
      const dateStr = d.toISOString().slice(0, 10);
      logs1.push(makeLog(dateStr, 500));
      logs2.push(makeLog(dateStr, 2000));
    }

    const result1 = computeKineticImpact(logs1);
    const result2 = computeKineticImpact(logs2);

    expect(result2.score).toBeGreaterThanOrEqual(result1.score);
  });

  it('handles single log edge case', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeKineticImpact([makeLog(today, 1000)]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('handles all same exercises', () => {
    const baseDate = new Date();
    const logs: WorkoutLog[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      logs.push(makeLog(d.toISOString().slice(0, 10), 1000, 'same_ex'));
    }
    const result = computeKineticImpact(logs);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns consistent label for score ranges', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeKineticImpact([makeLog(today, 1000)]);
    expect(['poor', 'fair', 'good', 'excellent']).toContain(result.label);
  });
});
