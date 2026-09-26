/** Minimal RFC 4180 parser used only by tests to verify round-tripping. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i += 1; continue; }
      cell += ch; i += 1; continue;
    }
    if (ch === '"' && cell === '') { quoted = true; i += 1; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i += 1; continue; }
    if (ch === '\r' && input[i + 1] === '\n') { i += 1; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; continue; }
    cell += ch; i += 1;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
