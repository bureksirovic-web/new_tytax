/**
 * Post-login redirect target validation (PLAN §7 threat sketch: open redirect
 * via `next=`). Only same-origin relative paths whose first segment is an
 * explicitly allowed app section, or one of ALLOWED_NEXT_EXACT, are accepted;
 * everything else falls back to DEFAULT_NEXT_PATH.
 */

export const DEFAULT_NEXT_PATH = '/dashboard';

export const ALLOWED_NEXT_SEGMENTS = [
  'dashboard',
  'workout',
  'programs',
  'exercises',
  'history',
  'analytics',
  'settings',
  'tools',
] as const;

export type AllowedNextSegment = (typeof ALLOWED_NEXT_SEGMENTS)[number];

const ALLOWED = new Set<string>(ALLOWED_NEXT_SEGMENTS);

/**
 * Exact paths outside the section allow-list (G5's account page). Only these
 * paths themselves (with an optional trailing slash, query or hash), never
 * anything below them, so the rest of /auth (login, callback) stays excluded.
 */
export const ALLOWED_NEXT_EXACT = ['/auth/account'] as const;

const EXACT = new Set<string>(ALLOWED_NEXT_EXACT);

/** Longest `next` we accept; anything longer is not a path we generate. */
const MAX_NEXT_LENGTH = 2048;

// Control characters (C0, DEL, C1) and any Unicode whitespace.
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\s\\]/;

function isDotSegment(segment: string): boolean {
  // The WHATWG URL parser treats %2e (any case) as '.', so check both forms.
  const normalised = segment.toLowerCase().replace(/%2e/g, '.');
  return normalised === '.' || normalised === '..';
}

/** Structural checks shared by the raw and the once-decoded value. */
function isSafeRelativePath(value: string): boolean {
  if (FORBIDDEN_CHARS.test(value)) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;

  const pathEnd = value.search(/[?#]/);
  const path = pathEnd === -1 ? value : value.slice(0, pathEnd);
  const segments = path.split('/').slice(1); // drop the empty segment before the leading '/'

  if (EXACT.has(path) || EXACT.has(path.replace(/\/$/, ''))) return true;

  const [first, ...rest] = segments;
  if (!first || !ALLOWED.has(first)) return false;

  for (let i = 0; i < rest.length; i++) {
    const segment = rest[i];
    // An empty segment is only allowed as a trailing slash ('/dashboard/').
    if (segment === '' && i !== rest.length - 1) return false;
    if (isDotSegment(segment)) return false;
  }
  return true;
}

/**
 * Returns `next` unchanged if it is a safe same-origin relative path into an
 * allowed section (query and hash preserved), otherwise DEFAULT_NEXT_PATH.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > MAX_NEXT_LENGTH) {
    return DEFAULT_NEXT_PATH;
  }
  if (!isSafeRelativePath(next)) return DEFAULT_NEXT_PATH;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  if (!isSafeRelativePath(decoded)) return DEFAULT_NEXT_PATH;

  return next;
}
