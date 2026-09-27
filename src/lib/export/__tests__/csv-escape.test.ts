import { describe, it, expect } from 'vitest';
import { escapeCsvCell, isDangerousCellText } from '../csv-escape';
import { parseCsv } from './rfc4180';

describe('escapeCsvCell: formula injection', () => {
  const dangerous = ['=', '+', '-', '@', '\t', '\r', '\u0000', '\u001F', '＝', '＋', '－', '＠'];

  it.each(dangerous)('neutralizes leading %j', (ch) => {
    const out = escapeCsvCell(`${ch}1+1`);
    const [[parsed]] = parseCsv(out);
    expect(parsed).toBe(`'${ch}1+1`);
    expect(parsed.startsWith("'")).toBe(true);
    expect(isDangerousCellText(parsed)).toBe(false);
  });

  it('neutralizes and quotes a HYPERLINK exercise name', () => {
    const out = escapeCsvCell('=HYPERLINK("http://x")');
    expect(out).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(parseCsv(out)).toEqual([["'=HYPERLINK(\"http://x\")"]]);
  });

  it('neutralizes leading LF and quotes it (the segment after the LF too)', () => {
    expect(escapeCsvCell('\n=1')).toBe('"\'\n\'=1"');
  });

  it('leaves dangerous chars alone when not leading', () => {
    expect(escapeCsvCell('a=b')).toBe('a=b');
    expect(escapeCsvCell('Ana @ gym')).toBe('Ana @ gym');
    expect(escapeCsvCell(' =1')).toBe(' =1');
  });

  it('keeps real numbers numeric, including negatives', () => {
    expect(escapeCsvCell(-2.5)).toBe('-2.5');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(100)).toBe('100');
    expect(escapeCsvCell(BigInt(-5))).toBe('-5');
  });

  it('prefixes numeric-looking strings (documented decision)', () => {
    expect(escapeCsvCell('-2.5')).toBe("'-2.5");
    expect(escapeCsvCell('+385')).toBe("'+385");
  });

  it('exports non-finite numbers as empty cells', () => {
    expect(escapeCsvCell(Number.NaN)).toBe('');
    expect(escapeCsvCell(Number.NEGATIVE_INFINITY)).toBe('');
    expect(escapeCsvCell(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('escapeCsvCell: value conversion and RFC 4180 quoting', () => {
  it('maps null/undefined to empty', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell('')).toBe('');
  });

  it('stringifies booleans, dates and objects', () => {
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
    expect(escapeCsvCell(new Date('2024-01-02T03:04:05.000Z'))).toBe('2024-01-02T03:04:05.000Z');
    expect(escapeCsvCell(new Date('invalid'))).toBe('');
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(escapeCsvCell(() => 1)).toBe('');
  });

  it('quotes commas, quotes, CR and LF', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('round-trips awkward values through an RFC 4180 parser', () => {
    const values = ['Marko, "The Tank"', 'multi\nline', 'crlf\r\nline', '""', 'plain', 'é ü ž'];
    const line = values.map(escapeCsvCell).join(',');
    expect(parseCsv(line)).toEqual([values]);
  });
});
