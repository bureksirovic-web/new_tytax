import type { BodyweightEntry, Units, WorkoutLog } from '@/contracts';
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

/** Exact international avoirdupois factor (1 lb = 0.45359237 kg), 9 significant digits. */
export const LB_PER_KG = 2.20462262;

export interface CsvExportOptions {
  /** Display units for weight columns. Storage is always kg. Default 'kg'. */
  units?: Units;
}

const WEIGHT_HEADER_INDEX = 4;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Converts a stored kg value for display. 'kg' is returned unchanged (no
 * rounding, legacy behaviour); 'lb' is rounded to 0.1.
 */
export function displayWeight(kg: number, units: Units = 'kg'): number {
  return units === 'lb' ? round1(kg * LB_PER_KG) : kg;
}

function weightHeader(units: Units): string {
  return units === 'lb' ? 'Weight (lb)' : 'Weight (kg)';
}

function withWeightHeader(headers: readonly string[], index: number, units: Units): string[] {
  return headers.map((h, i) => (i === index ? weightHeader(units) : h));
}

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

/**
 * One row per set. `Set #` is the 1-based index within its SessionExercise;
 * `Volume` is weight × reps in the display unit ('lb' rounded to 0.1).
 */
export function workoutLogsToCSV(logs: readonly WorkoutLog[], opts: CsvExportOptions = {}): string {
  const units = opts.units ?? 'kg';
  const rows: unknown[][] = [];
  for (const log of orderedLiveLogs(logs)) {
    const minutes = Math.round(log.durationSeconds / 60);
    for (const ex of log.exercises) {
      ex.sets.forEach((set, i) => {
        rows.push([
          log.date,
          minutes,
          ex.exerciseName,
          i + 1,
          displayWeight(set.kg, units),
          set.reps,
          displayWeight(set.kg * set.reps, units),
          ex.modality,
          set.rir,
          set.type,
          set.done,
        ]);
      });
    }
  }
  return rowsToCSV(withWeightHeader(WORKOUT_CSV_HEADERS, WEIGHT_HEADER_INDEX, units), rows);
}

/** Live bodyweight history ordered by date then createdAt; soft-deleted entries are skipped. */
export function bodyweightToCSV(entries: readonly BodyweightEntry[], opts: CsvExportOptions = {}): string {
  const units = opts.units ?? 'kg';
  const rows = entries
    .filter(e => !e.deletedAt)
    .sort((a, b) => compareStrings(a.date, b.date) || compareStrings(a.createdAt, b.createdAt))
    .map(e => [e.date, displayWeight(e.valueKg, units)]);
  return rowsToCSV(withWeightHeader(BODYWEIGHT_CSV_HEADERS, 1, units), rows);
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
  try {
    a.click();
  } finally {
    a.remove();
    // Revoke after the click has been dispatched (G4-35): an immediate revoke
    // can abort the download in some browsers. Runs even if click threw.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
