import { describe, it, expect } from 'vitest';
import { workoutLogsToCSV } from '../csv';
import type { WorkoutLog } from '@/types/workout';

function makeLog(
  date: string,
  exercises: Array<{
    name: string;
    sets: Array<{ kg: number; reps: number }>;
  }>,
  durationSeconds = 3600,
): WorkoutLog {
  return {
    id: `log-${date}`,
    profileId: 'test',
    sessionName: 'Test',
    date,
    startedAt: new Date().toISOString(),
    durationSeconds,
    exercises: exercises.map((ex, i) => ({
      exerciseRef: `ex-${i}`,
      exerciseName: ex.name,
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
    totalVolumeKg: 0,
    totalSets: 0,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('workoutLogsToCSV', () => {
  it('generates valid CSV header row', () => {
    const result = workoutLogsToCSV([]);
    const lines = result.split('\n');
    expect(lines[0]).toBe('Date,Duration (min),Exercise,Set #,Weight (kg),Reps,Volume,Modality');
  });

  it('includes all workout data (exercises, sets, volume)', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          name: 'Bench Press',
          sets: [
            { kg: 100, reps: 5 },
            { kg: 90, reps: 8 },
          ],
        },
      ]),
    ];

    const result = workoutLogsToCSV(logs);
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2024-01-01');
    expect(lines[1]).toContain('Bench Press');
    expect(lines[1]).toContain('100');
    expect(lines[1]).toContain('5');
    expect(lines[1]).toContain('500');
    expect(lines[2]).toContain('90');
    expect(lines[2]).toContain('8');
    expect(lines[2]).toContain('720');
  });

  it('handles empty logs array', () => {
    const result = workoutLogsToCSV([]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Date,Duration (min),Exercise,Set #,Weight (kg),Reps,Volume,Modality');
  });

  it('escapes special characters in exercise names', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          name: 'Bench Press, Heavy',
          sets: [{ kg: 100, reps: 5 }],
        },
      ]),
    ];

    const result = workoutLogsToCSV(logs);
    expect(result).toContain('"Bench Press, Heavy"');
  });

  it('escapes double quotes in exercise names', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          name: 'Bench "Press"',
          sets: [{ kg: 100, reps: 5 }],
        },
      ]),
    ];

    const result = workoutLogsToCSV(logs);
    expect(result).toContain('"Bench ""Press"""');
  });

  it('includes multiple exercises from same workout', () => {
    const logs = [
      makeLog('2024-01-01', [
        { name: 'Bench Press', sets: [{ kg: 100, reps: 5 }] },
        { name: 'Squat', sets: [{ kg: 120, reps: 5 }] },
      ]),
    ];

    const result = workoutLogsToCSV(logs);
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Bench Press');
    expect(lines[2]).toContain('Squat');
  });

  it('includes duration in minutes', () => {
    const logs = [
      makeLog('2024-01-01', [
        { name: 'Bench', sets: [{ kg: 100, reps: 5 }] },
      ], 1800),
    ];

    const result = workoutLogsToCSV(logs);
    expect(result).toContain('30');
  });

  it('handles multiple workouts', () => {
    const logs = [
      makeLog('2024-01-01', [
        { name: 'Bench', sets: [{ kg: 100, reps: 5 }] },
      ]),
      makeLog('2024-01-02', [
        { name: 'Squat', sets: [{ kg: 120, reps: 5 }] },
      ]),
    ];

    const result = workoutLogsToCSV(logs);
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2024-01-01');
    expect(lines[2]).toContain('2024-01-02');
  });
});
