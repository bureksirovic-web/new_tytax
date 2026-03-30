import { describe, it, expect } from 'vitest';
import { computeACWR, getACWRZone } from '../acwr';
import type { WorkoutLog } from '@/types/workout';

function makeLog(date: string, volumeKg: number): WorkoutLog {
  return {
    id: date,
    profileId: 'test',
    sessionName: 'Test Session',
    date,
    startedAt: new Date().toISOString(),
    durationSeconds: 3600,
    exercises: [{
      exerciseRef: 'test_ex',
      exerciseName: 'Test',
      modality: 'tytax',
      sets: [{ id: 'set1', setNumber: 1, type: 'working', done: true, timestamp: new Date().toISOString(), kg: volumeKg, reps: 1 }],
      muscleImpactSnapshot: [],
    }],
    totalVolumeKg: volumeKg,
    totalSets: 1,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: undefined,
    deletedAt: undefined,
  };
}

describe('computeACWR', () => {
  it('returns [] for empty logs', () => {
    expect(computeACWR([])).toEqual([]);
  });

  it('returns ratio of 1.0 for a single workout', () => {
    const logs = [makeLog('2024-01-01', 1000)];
    const result = computeACWR(logs);
    expect(result).toHaveLength(1);
    expect(result[0].ratio).toBe(1.0);
  });

  it('calculates higher ratio for high recent volume', () => {
    // 3 weeks of low volume
    const logs = [
      makeLog('2024-01-01', 1000),
      makeLog('2024-01-08', 1000),
      makeLog('2024-01-15', 1000),
      // 1 week of very high volume
      makeLog('2024-01-22', 4000),
    ];

    const result = computeACWR(logs);
    const lastResult = result[result.length - 1];

    expect(lastResult.ratio).toBeGreaterThan(1.3);
  });
});

describe('getACWRZone', () => {
  it('returns undertrain for < 0.8', () => {
    expect(getACWRZone(0.5)).toBe('undertrain');
    expect(getACWRZone(0.79)).toBe('undertrain');
  });

  it('returns optimal for 0.8 to 1.3', () => {
    expect(getACWRZone(0.8)).toBe('optimal');
    expect(getACWRZone(1.0)).toBe('optimal');
    expect(getACWRZone(1.3)).toBe('optimal');
  });

  it('returns caution for 1.3 to 1.5', () => {
    expect(getACWRZone(1.31)).toBe('caution');
    expect(getACWRZone(1.4)).toBe('caution');
    expect(getACWRZone(1.5)).toBe('caution');
  });

  it('returns danger for > 1.5', () => {
    expect(getACWRZone(1.51)).toBe('danger');
    expect(getACWRZone(1.6)).toBe('danger');
  });
});
