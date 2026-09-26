import type { BodyweightEntry, WorkoutLog } from '@/types/workout';
import { escapeCsvCell } from './csv-escape';

/**
 * CSV export. Output uses LF ("\n") line endings throughout (RFC 4180 allows
 * CRLF, but every mainstream spreadsheet reads LF and it keeps tests simple).
 * The UTF-8 BOM is added only by downloadCSV (for Excel), never by the pure
 * string builders.
 */
export const CSV_EOL = '\n';
export const UTF8_BOM = '﻿';

export const WORKOUT_CSV_HEADERS: readonly string[] = [
  // Legacy columns: order and names must stay stable for existing consumers.
  'Date', 'Duration (min)', 'Exercise', 'Set #', 'Weight (kg)', 'Reps', 'Volume', 'Modality',
  // Appended in v2.
  'RIR', 'Set type', 'Done',
];

export const BODYWEIGHT_CSV_HEADERS: readonly string[] = ['Date', 'Weight (kg)'];

/** Generic builder: every header and cell goes through escapeCsvCell. */
export function rowsToCSV(
  headers: readonly unknown[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  return [headers, ...rows].map(r => r.map(escapeCsvCell).join(',')).join(CSV_EOL);
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Live (not soft-deleted) logs, ordered by date then startedAt (stable). */
function orderedLiveLogs(logs: readonly WorkoutLog[]): WorkoutLog[] {
  return logs
    .filter(log => !log.deletedAt)
    .sort((a, b) => compareStrings(a.date, b.date) || compareStrings(a.startedAt, b.startedAt));
}

export function workoutLogsToCSV(logs: readonly WorkoutLog[]): string {
  const rows: unknown[][] = [];
  for (const log of orderedLiveLogs(logs)) {
    const minutes = Math.round(log.durationSeconds / 60);
    for (const ex of log.exercises) {
      ex.sets.forEach((set, i) => {
        const kg = set.kg ?? 0;
        const reps = set.reps ?? 0;
        rows.push([
          log.date,
          minutes,
          ex.exerciseName,
          i + 1,
          set.kg,
          set.reps,
          kg * reps,
          ex.modality ?? '',
          set.rir,
          set.type,
          set.done,
        ]);
      });
    }
  }
  return rowsToCSV(WORKOUT_CSV_HEADERS, rows);
}

/** Bodyweight history ordered by date then createdAt. */
export function bodyweightToCSV(entries: readonly BodyweightEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => compareStrings(a.date, b.date) || compareStrings(a.createdAt, b.createdAt))
    .map(e => [e.date, e.valueKg]);
  return rowsToCSV(BODYWEIGHT_CSV_HEADERS, rows);
}

/** Trigger a browser download. Prefixes a UTF-8 BOM so Excel detects encoding. */
export function downloadCSV(content: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([UTF8_BOM, content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been dispatched; immediate revoke can abort
  // the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
