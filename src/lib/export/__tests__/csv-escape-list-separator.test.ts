/**
 * CSV formula injection through the locale list separator.
 *
 * Excel in hr-HR (the app ships a Croatian UI), de-DE, fr-FR opens a
 * double-clicked .csv with ';' as the separator. escapeCsvCell used to quote
 * only on , " CR LF, so "Bench;=cmd|..." was emitted unquoted and Excel
 * started a new cell with an un-neutralised '='. Cells containing ';' or TAB
 * are now quoted, and because Excel only honours a quote at the start of a
 * field, every segment after ';' TAB CR LF that starts with a formula
 * character is also "'"-prefixed: a quote-aware split of an exported row on
 * ';' or TAB yields no cell a spreadsheet would treat as a formula.
 */
import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts';
import { escapeCsvCell, isDangerousCellText } from '../csv-escape';
import { workoutLogsToCSV } from '../csv';

/** Quote-aware split of one line on `sep`, as Excel does for its list separator. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { out.push(cell); cell = ''; } else cell += ch;
  }
  out.push(cell);
  return out;
}

const PAYLOAD = "Bench;=cmd|' /C calc'!A0;";

function log(exerciseName: string): WorkoutLog {
  const t = '2026-03-02T12:00:00.000Z';
  return {
    id: 'w1', profileId: 'p1', sessionName: 'A', date: '2026-03-02', startedAt: t, finishedAt: t, durationSeconds: 3600,
    exercises: [{ uid: 'u1', exerciseId: 'custom-1', exerciseName, modality: 'custom', sets: [{ id: 's1', type: 'working', kg: 40, reps: 5, done: true }] }],
    totalVolumeKg: 200, totalSets: 1, prCount: 0, modalitiesUsed: ['custom'], createdAt: t, updatedAt: t,
  };
}

describe('CSV cells survive a ";" or TAB list separator', () => {
  it('escapeCsvCell quotes a cell containing ";" or TAB', () => {
    expect(escapeCsvCell(PAYLOAD)).toBe(`"Bench;'=cmd|' /C calc'!A0;"`);
    expect(escapeCsvCell('Bench\t=1+1')).toBe(`"Bench\t'=1+1"`);
    expect(escapeCsvCell('Bench\n@SUM(A1)')).toBe(`"Bench\n'@SUM(A1)"`);
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('Push-ups; 5')).toBe('"Push-ups; 5"');
    expect(escapeCsvCell(-2.5)).toBe('-2.5');
    expect(escapeCsvCell('plain')).toBe('plain');
  });

  it.each([';', '\t', ','])('a workoutLogsToCSV row split on %j has no formula cell', (sep) => {
    for (const name of [PAYLOAD, 'Bench\t=1+1', 'Row\n=HYPERLINK("x")']) {
      // Every physical line after the header, as a quote-ignoring reader sees it.
      const cells = workoutLogsToCSV([log(name)]).split(/\r?\n/).slice(1).flatMap((l) => splitLine(l, sep));
      expect(cells.some((c) => isDangerousCellText(c))).toBe(false);
    }
  });

  it('with the "," separator the exercise name round-trips as one cell', () => {
    const cells = splitLine(workoutLogsToCSV([log(PAYLOAD)]).split('\n')[1], ',');
    expect(cells).toContain("Bench;'=cmd|' /C calc'!A0;");
  });
});
