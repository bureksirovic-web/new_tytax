import { describe, it, expect } from 'vitest';
import { bodyweightToCSV, rowsToCSV, workoutLogsToCSV, UTF8_BOM } from '../csv';
import type { BodyweightEntry, SetEntry, WorkoutLog } from '@/contracts';
import { parseCsv } from './rfc4180';

function set(overrides: Partial<SetEntry> = {}): SetEntry {
  return {
    id: 's1', type: 'working', kg: 50, reps: 10, done: true,
    completedAt: '2024-01-01T10:00:00.000Z', ...overrides,
  };
}

function log(overrides: Partial<WorkoutLog> & { name?: string; sets?: SetEntry[] } = {}): WorkoutLog {
  const { name = 'Squat', sets = [set()], ...rest } = overrides;
  return {
    id: 'l1', profileId: 'ana', sessionName: 'Day A', date: '2024-01-01',
    startedAt: '2024-01-01T10:00:00.000Z', finishedAt: '2024-01-01T11:00:00.000Z', durationSeconds: 3600,
    exercises: [{ uid: 'u1', exerciseId: 'ex-1', exerciseName: name, modality: 'tytax', sets }],
    totalVolumeKg: 0, totalSets: 0, prCount: 0, modalitiesUsed: ['tytax'],
    createdAt: '2024-01-01T10:00:00.000Z', updatedAt: '2024-01-01T10:00:00.000Z',
    ...rest,
  };
}

describe('workoutLogsToCSV (v2)', () => {
  it('appends RIR, set type and done columns', () => {
    const csv = workoutLogsToCSV([log({ sets: [set({ rir: 2, type: 'drop', done: false })] })]);
    const [header, row] = parseCsv(csv);
    expect(header.slice(-3)).toEqual(['RIR', 'Set type', 'Done']);
    expect(row).toEqual(['2024-01-01', '60', 'Squat', '1', '50', '10', '500', 'tytax', '2', 'drop', 'false']);
  });

  it('numbers sets by index within each SessionExercise', () => {
    const l = log({ sets: [set({ id: 'a' }), set({ id: 'b', type: 'warmup' })] });
    l.exercises.push({ uid: 'u2', exerciseId: 'ex-1', exerciseName: 'Squat', modality: 'kettlebell', sets: [set({ id: 'c' })] });
    const rows = parseCsv(workoutLogsToCSV([l])).slice(1);
    expect(rows.map(r => [r[3], r[7], r[9]])).toEqual([
      ['1', 'tytax', 'working'], ['2', 'tytax', 'warmup'], ['1', 'kettlebell', 'working'],
    ]);
  });

  it('leaves RIR empty when absent', () => {
    const [, row] = parseCsv(workoutLogsToCSV([log()]));
    expect(row[8]).toBe('');
    expect(row[10]).toBe('true');
  });

  it('skips soft-deleted logs', () => {
    const csv = workoutLogsToCSV([
      log({ id: 'keep', name: 'Keep Me' }),
      log({ id: 'gone', name: 'Deleted', deletedAt: '2024-01-02T00:00:00.000Z' }),
    ]);
    expect(csv).toContain('Keep Me');
    expect(csv).not.toContain('Deleted');
    expect(parseCsv(csv)).toHaveLength(2);
  });

  it('orders by date then startedAt without mutating input', () => {
    const input = [
      log({ date: '2024-01-02', startedAt: '2024-01-02T08:00:00.000Z', name: 'C' }),
      log({ date: '2024-01-01', startedAt: '2024-01-01T18:00:00.000Z', name: 'B' }),
      log({ date: '2024-01-01', startedAt: '2024-01-01T07:00:00.000Z', name: 'A' }),
    ];
    const names = parseCsv(workoutLogsToCSV(input)).slice(1).map(r => r[2]);
    expect(names).toEqual(['A', 'B', 'C']);
    expect(input.map(l => l.exercises[0].exerciseName)).toEqual(['C', 'B', 'A']);
  });

  it('neutralizes a malicious exercise name and keeps negative numbers numeric', () => {
    const csv = workoutLogsToCSV([log({ name: '=HYPERLINK("http://x")', sets: [set({ kg: -2.5, reps: 4 })] })]);
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")"');
    const [, row] = parseCsv(csv);
    expect(row[2]).toBe("'=HYPERLINK(\"http://x\")");
    expect(row[4]).toBe('-2.5');
    expect(row[6]).toBe('-10');
  });

  it('never includes a BOM or CRLF in the string output', () => {
    const csv = workoutLogsToCSV([log(), log({ date: '2024-02-01' })]);
    expect(csv.startsWith(UTF8_BOM)).toBe(false);
    expect(csv).not.toContain('\r\n');
    expect(csv.split('\n')).toHaveLength(3);
  });
});

describe('bodyweightToCSV', () => {
  const entry = (date: string, valueKg: number, createdAt: string): BodyweightEntry => ({
    id: `${date}-${createdAt}`, profileId: 'marko', date, valueKg, createdAt, updatedAt: createdAt,
  });

  it('exports ordered date and weight rows', () => {
    const csv = bodyweightToCSV([
      entry('2024-03-02', 81.2, '2024-03-02T09:00:00.000Z'),
      entry('2024-03-01', 80.5, '2024-03-01T20:00:00.000Z'),
      entry('2024-03-01', 80.1, '2024-03-01T07:00:00.000Z'),
    ]);
    expect(parseCsv(csv)).toEqual([
      ['Date', 'Weight (kg)'],
      ['2024-03-01', '80.1'],
      ['2024-03-01', '80.5'],
      ['2024-03-02', '81.2'],
    ]);
  });

  it('skips soft-deleted entries without mutating input', () => {
    const input = [
      entry('2024-03-02', 81.2, '2024-03-02T09:00:00.000Z'),
      { ...entry('2024-03-01', 99, '2024-03-01T07:00:00.000Z'), deletedAt: '2024-03-03T00:00:00.000Z' },
    ];
    expect(parseCsv(bodyweightToCSV(input))).toEqual([['Date', 'Weight (kg)'], ['2024-03-02', '81.2']]);
    expect(input.map(e => e.date)).toEqual(['2024-03-02', '2024-03-01']);
  });

  it('returns only the header for no entries', () => {
    expect(bodyweightToCSV([])).toBe('Date,Weight (kg)');
  });
});

describe('rowsToCSV', () => {
  it('escapes headers and cells and round-trips', () => {
    const rows = [['Ana, Jr.', 'line\nbreak', 3], ['@evil', null, -1]];
    const csv = rowsToCSV(['Name', 'Note "x"', 'N'], rows);
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Note "x"', 'N'],
      ['Ana, Jr.', 'line\nbreak', '3'],
      ["'@evil", '', '-1'],
    ]);
  });

  it('handles an empty table', () => {
    expect(rowsToCSV([], [])).toBe('');
  });
});
