import { describe, it, expect } from 'vitest';
import { bodyweightToCSV, displayWeight, LB_PER_KG, workoutLogsToCSV } from '../csv';
import { buildWorkoutLog, sequentialIds } from '@/contracts';
import type { BodyweightEntry, WorkoutLog } from '@/contracts';
import { parseCsv } from './rfc4180';

const NOW = new Date('2024-05-10T12:00:00.000Z');

function logWith(sets: Array<{ kg: number; reps: number }>, exerciseName = 'Bench'): WorkoutLog {
  return buildWorkoutLog(
    'p-1',
    { daysAgo: 1, exercises: [{ exerciseId: 'bench', exerciseName, sets }] },
    NOW,
    sequentialIds('t'),
  );
}

describe('displayWeight', () => {
  it('returns kg unchanged by default and for kg', () => {
    expect(displayWeight(62.345)).toBe(62.345);
    expect(displayWeight(62.345, 'kg')).toBe(62.345);
  });

  it('converts to lb rounded to 0.1', () => {
    expect(LB_PER_KG).toBe(2.20462262);
    expect(displayWeight(100, 'lb')).toBe(220.5);
    expect(displayWeight(20, 'lb')).toBe(44.1);
    expect(displayWeight(0, 'lb')).toBe(0);
    expect(displayWeight(-2.5, 'lb')).toBe(-5.5);
  });
});

describe('workoutLogsToCSV units option', () => {
  it('keeps the kg header and raw values by default', () => {
    const [header, row] = parseCsv(workoutLogsToCSV([logWith([{ kg: 100, reps: 5 }])]));
    expect(header[4]).toBe('Weight (kg)');
    expect(row.slice(4, 7)).toEqual(['100', '5', '500']);
  });

  it('switches the header and converts weight and volume to lb', () => {
    const csv = workoutLogsToCSV([logWith([{ kg: 100, reps: 5 }, { kg: 22.5, reps: 3 }])], { units: 'lb' });
    const [header, first, second] = parseCsv(csv);
    expect(header).toEqual([
      'Date', 'Duration (min)', 'Exercise', 'Set #', 'Weight (lb)', 'Reps', 'Volume', 'Modality',
      'RIR', 'Set type', 'Done',
    ]);
    expect(first.slice(3, 7)).toEqual(['1', '220.5', '5', '1102.3']);
    expect(second.slice(3, 7)).toEqual(['2', '49.6', '3', '148.8']);
  });

  it('still neutralises formula-like names in lb mode', () => {
    const csv = workoutLogsToCSV([logWith([{ kg: 10, reps: 1 }], '@SUM(A1)')], { units: 'lb' });
    expect(parseCsv(csv)[1][2]).toBe("'@SUM(A1)");
  });

  it('explicit kg matches the default output', () => {
    const logs = [logWith([{ kg: 61.25, reps: 7 }])];
    expect(workoutLogsToCSV(logs, { units: 'kg' })).toBe(workoutLogsToCSV(logs));
  });
});

describe('bodyweightToCSV units option', () => {
  const entry: BodyweightEntry = {
    id: 'bw-1', profileId: 'p-1', date: '2024-05-01', valueKg: 80,
    createdAt: '2024-05-01T07:00:00.000Z', updatedAt: '2024-05-01T07:00:00.000Z',
  };

  it('exports lb with the lb header', () => {
    expect(parseCsv(bodyweightToCSV([entry], { units: 'lb' }))).toEqual([
      ['Date', 'Weight (lb)'],
      ['2024-05-01', '176.4'],
    ]);
  });

  it('defaults to kg', () => {
    expect(bodyweightToCSV([entry])).toBe('Date,Weight (kg)\n2024-05-01,80');
  });
});
