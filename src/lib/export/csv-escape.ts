/**
 * CSV cell escaping with formula-injection protection.
 *
 * Threat: a value such as `=HYPERLINK("http://x")` typed as an exercise name
 * would be evaluated as a formula when the exported file is opened in Excel,
 * LibreOffice or Google Sheets (OWASP "CSV Injection").
 *
 * Decisions:
 * - A cell whose text starts with = + - @ TAB CR LF (or the full-width forms
 *   ＝ ＋ － ＠) is prefixed with a single quote so spreadsheets show it as text.
 * - So is any cell starting with a C0 control character (U+0000-U+001F):
 *   LibreOffice Calc drops a leading NUL on import and then evaluates the rest
 *   ("\0=1+1" -> 2), so a control-char prefix must not hide a formula.
 * - Only values of JS type `number` (finite) skip that check, so numeric
 *   columns (including negatives like -2.5) stay numeric. A *string* that
 *   merely looks numeric ("-2.5") IS prefixed: its origin is user text and we
 *   cannot tell "-2.5" from "-2+5" safely without a full formula grammar.
 * - Non-finite numbers (NaN, ±Infinity) are exported as empty cells.
 * - After neutralisation, RFC 4180 quoting: the cell is wrapped in double
 *   quotes when it contains a comma, double quote, CR or LF; inner double
 *   quotes are doubled.
 * - null / undefined become an empty cell.
 * - Objects are JSON-encoded (bigint as its decimal string); anything that
 *   cannot be encoded (circular, throwing toJSON) becomes an empty cell, so a
 *   single hostile value never aborts a whole export.
 */

const DANGEROUS_LEADING = new Set(['=', '+', '-', '@', '\t', '\r', '\n', '＝', '＋', '－', '＠']);

const NEEDS_QUOTING = /[",\r\n]/;

const LEADING_C0_CONTROL = /^[\u0000-\u001F]/;

function bigintSafe(_key: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

/** JSON-encode an object without ever throwing. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, bigintSafe) ?? '';
  } catch {
    return '';
  }
}

/** Convert an arbitrary value to its raw (unescaped) cell text. */
function toCellText(value: unknown): { text: string; trustedNumber: boolean } {
  if (value === null || value === undefined) return { text: '', trustedNumber: false };
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { text: String(value), trustedNumber: true }
      : { text: '', trustedNumber: false };
  }
  if (typeof value === 'string') return { text: value, trustedNumber: false };
  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return { text: String(value), trustedNumber: typeof value === 'bigint' };
  }
  if (value instanceof Date) {
    return { text: Number.isNaN(value.getTime()) ? '' : value.toISOString(), trustedNumber: false };
  }
  return { text: safeJson(value), trustedNumber: false };
}

/** True when a spreadsheet could interpret the text as a formula. */
export function isDangerousCellText(text: string): boolean {
  return (
    text.length > 0 && (DANGEROUS_LEADING.has(text.charAt(0)) || LEADING_C0_CONTROL.test(text))
  );
}

/** Escape one value into a safe, RFC 4180-quoted CSV cell. */
export function escapeCsvCell(value: unknown): string {
  const { text, trustedNumber } = toCellText(value);
  const safe = !trustedNumber && isDangerousCellText(text) ? `'${text}` : text;
  return NEEDS_QUOTING.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
