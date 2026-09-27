/**
 * Typed remote failures. `retryable` failures are retried with backoff;
 * permanent ones fail the op (dead letter) and never block the queue;
 * `auth_required` stops the run and keeps the outbox untouched.
 */

export interface RemoteError {
  /** Postgres/PostgREST code, `auth_required`, `network`, or the HTTP status. */
  code: string;
  retryable: boolean;
  /** 401 / expired JWT: wait for a sign-in, never drop the op. */
  authRequired?: boolean;
}

/**
 * RLS denial, unique, FK, check and bad-input violations, and the account
 * quota of migration 004 (PT413, HTTP 413): the same row fails again.
 */
const PERMANENT_CODES = new Set(['42501', '23505', '23503', '23514', '23502', '22P02', '22001', '22003', '22007', '22023', 'PT413']);

/** PostgREST JWT errors (expired, invalid, missing claim). */
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

export const AUTH_REQUIRED: RemoteError = Object.freeze({ code: 'auth_required', retryable: false, authRequired: true });
export const NETWORK_ERROR: RemoteError = Object.freeze({ code: 'network', retryable: true });
/**
 * The signed-in account is no longer the one the run started with: the run
 * stops with its ops still live (never dead-lettered) and retries under the
 * new session, where ops of the old account's profiles stay deferred.
 */
export const ACCOUNT_CHANGED: RemoteError = Object.freeze({ code: 'account_changed', retryable: true });
/** Postgres insufficient_privilege: the RLS policy refused the row. */
export const RLS_DENIED = '42501';

export interface ErrorInput {
  /** HTTP status; 0 or undefined when the request never completed. */
  status?: number;
  code?: string | null;
}

export function classifyRemoteError({ status, code }: ErrorInput): RemoteError {
  const c = code ?? '';
  if (status === 401 || AUTH_CODES.has(c)) return AUTH_REQUIRED;
  if (PERMANENT_CODES.has(c)) return { code: c, retryable: false };
  // Schema cache misses (a migration not yet applied): retry until the deploy lands.
  if (c.startsWith('PGRST2')) return { code: c, retryable: true };
  if (status === undefined || status === 0) return NETWORK_ERROR;
  if (status === 429 || status >= 500) return { code: c || String(status), retryable: true };
  if (status >= 400) return { code: c || String(status), retryable: false };
  return { code: c || 'unknown', retryable: true };
}

/** Dead-letter marker written through `SyncOutbox.fail`; such ops are skipped by later runs. */
export const PERMANENT_PREFIX = 'permanent:';

export function isDeadLetter(lastError: string | undefined): boolean {
  return typeof lastError === 'string' && lastError.startsWith(PERMANENT_PREFIX);
}
