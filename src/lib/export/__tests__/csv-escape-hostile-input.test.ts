import { describe, it, expect } from 'vitest';
import { escapeCsvCell, isDangerousCellText } from '../csv-escape';
import { rowsToCSV } from '../csv';
import { parseCsv } from './rfc4180';

// Regression: LibreOffice Calc drops a leading NUL on CSV import and then
// evaluates the remainder as a formula ("\0=1+1" -> 2).
describe('escapeCsvCell: formula hidden behind leading control characters', () => {
  it.each([
    ['\u0000=HYPERLINK("http://evil.example";"x")'],
    ['\u0000\u0000=1+1'],
    ['\u0001=2+2'],
    ['\u001F@SUM(A1)'],
  ])('prefixes %j with a single quote', (input) => {
    const [[parsed]] = parseCsv(escapeCsvCell(input));
    expect(parsed).toBe(`'${input}`);
    expect(isDangerousCellText(parsed)).toBe(false);
  });

  it('flags any C0-control-led text as dangerous', () => {
    expect(isDangerousCellText('\u0000abc')).toBe(true);
    expect(isDangerousCellText('\u000B=1')).toBe(true);
    expect(isDangerousCellText(' =1')).toBe(false);
  });
});

describe('escapeCsvCell: never throws on hostile unknown input', () => {
  it('encodes a nested bigint as its decimal string', () => {
    const [[parsed]] = parseCsv(escapeCsvCell({ kg: BigInt(5) }));
    expect(parsed).toBe('{"kg":"5"}');
  });

  it('exports a circular object as an empty cell', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(escapeCsvCell(o)).toBe('');
    const csv = rowsToCSV(['x', 'y'], [[o, 'ok']]);
    const rows = parseCsv(csv.replace(/^﻿/, ''));
    expect(rows[rows.length - 1]).toEqual(['', 'ok']);
  });

  it('exports an object whose toJSON throws as an empty cell', () => {
    const bad = {
      toJSON(): never {
        throw new Error('boom');
      },
    };
    expect(escapeCsvCell(bad)).toBe('');
  });

  it('exports symbols and functions as empty cells', () => {
    expect(escapeCsvCell(Symbol('s'))).toBe('');
    expect(escapeCsvCell(() => 1)).toBe('');
  });
});
