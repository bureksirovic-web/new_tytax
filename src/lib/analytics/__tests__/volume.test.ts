import { describe, it, expect } from 'vitest';
import { computeWeeklyVolume, computeMonthlyTrend } from '../volume';
import type { WorkoutLog } from '@/types/workout';

function makeLog(date: string, volumeKg: number, muscle: string = 'Chest'): WorkoutLog {
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
      muscleImpactSnapshot: [{ muscle, score: 100 }],
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

describe('computeWeeklyVolume', () => {
  it('returns [] for empty logs', () => {
    expect(computeWeeklyVolume([])).toEqual([]);
  });

  it('groups logs by week correctly', () => {
    const logs = [
      makeLog('2024-01-01', 1000), // Monday
      makeLog('2024-01-03', 1500), // Wednesday
      makeLog('2024-01-10', 2000), // Next Wednesday
    ];

    const result = computeWeeklyVolume(logs);

    // Check we have two distinct weeks
    expect(result).toHaveLength(2);

    // Check that total volume for first week sums correctly
    expect(result[0].totalVolume).toBe(2500);
    expect(result[0].sessionCount).toBe(2);

    // Check total volume for second week
    expect(result[1].totalVolume).toBe(2000);
    expect(result[1].sessionCount).toBe(1);
  });

  it('calculates modalities and muscles correctly', () => {
    const logs = [
      makeLog('2024-01-01', 1000, 'Chest')
    ];

    const result = computeWeeklyVolume(logs);
    expect(result[0].byModality['tytax']).toBe(1000);
    expect(result[0].byMuscle['Chest']).toBe(1000);
  });
});

describe('computeMonthlyTrend', () => {
  it('groups by YYYY-MM', () => {
    const logs = [
      makeLog('2024-01-15', 1000),
      makeLog('2024-01-20', 1500),
      makeLog('2024-02-10', 2000),
    ];

    const result = computeMonthlyTrend(logs);

    expect(result).toHaveLength(2);

    expect(result[0].month).toBe('2024-01');
    expect(result[0].volume).toBe(2500);

    expect(result[1].month).toBe('2024-02');
    expect(result[1].volume).toBe(2000);
  });
});
