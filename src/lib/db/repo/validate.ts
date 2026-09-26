/** Input validation helpers; every failure is a `RepoError('VALIDATION')`. */
import { RepoError } from '@/contracts/repo';

// ─── Validation ──────────────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDay(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function assertDay(v: unknown, field: string): asserts v is string {
  if (!isCalendarDay(v)) throw new RepoError('VALIDATION', `${field} must be a 'YYYY-MM-DD' date`);
}

export function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 10 && Number.isFinite(Date.parse(v));
}

export function assertTimestamp(v: unknown, field: string): asserts v is string {
  if (!isIsoTimestamp(v)) throw new RepoError('VALIDATION', `${field} must be an ISO timestamp`);
}

export function assertNonNegative(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number >= 0`);
  }
}

export function assertPositive(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number > 0`);
  }
}

export function assertNonEmpty(v: unknown, field: string): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '') throw new RepoError('VALIDATION', `${field} must not be empty`);
}

export function notFound(what: string, id: string): RepoError {
  return new RepoError('NOT_FOUND', `${what} ${id} not found`);
}
