// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
import { describe, expect, it } from 'vitest';
import { ALLOWED_NEXT_SEGMENTS, DEFAULT_NEXT_PATH, safeNextPath } from '../redirect';

const D = DEFAULT_NEXT_PATH;

const cases: Array<[string, string | null | undefined, string]> = [
  // allowed
  ['plain allowed section', '/dashboard', '/dashboard'],
  ['nested path', '/workout/active', '/workout/active'],
  ['query preserved', '/settings?tab=sync', '/settings?tab=sync'],
  ['hash preserved', '/history#last', '/history#last'],
  ['query + hash preserved', '/analytics?range=30d#acwr', '/analytics?range=30d#acwr'],
  ['trailing slash', '/programs/', '/programs/'],
  ['encoded space (decodes to whitespace)', '/exercises/bench%20press', D],
  ['encoded id', '/programs/abc%2D123', '/programs/abc%2D123'],
  ['tools section', '/tools/plate-calc', '/tools/plate-calc'],
  ['colon in query is not a scheme', '/settings?return=https://x', '/settings?return=https://x'],
  // empty / wrong type
  ['empty string', '', D],
  ['null', null, D],
  ['undefined', undefined, D],
  ['root only', '/', D],
  // protocol-relative and backslash tricks
  ['protocol-relative', '//evil.com', D],
  ['backslash after slash', '/\\evil.com', D],
  ['backslash anywhere', '/dashboard\\..\\evil', D],
  ['encoded double slash', '/%2F%2Fevil.com', D],
  ['encoded backslash', '/%5Cevil.com', D],
  ['encoded slash inside allowed', '/dashboard/%2F%2Fevil.com', D],
  ['triple slash', '///evil.com', D],
  // schemes
  ['absolute https', 'https://evil.com', D],
  ['javascript scheme', 'javascript:alert(1)', D],
  ['data scheme', 'data:text/html,<script>alert(1)</script>', D],
  ['relative without slash', 'dashboard', D],
  // allow-list
  ['prefix of allowed segment', '/dashboardx', D],
  ['allowed as suffix', '/dashboardevil', D],
  ['case mismatch', '/Dashboard', D],
  ['not in allow-list', '/admin', D],
  ['auth route not allowed', '/auth/login', D],
  ['api route not allowed', '/api/sync', D],
  // whitespace and control characters
  ['leading space', ' /dashboard', D],
  ['space in path', '/ dashboard', D],
  ['tab then slash', '/\t/evil', D],
  ['newline', '/dashboard\n', D],
  ['NUL byte', '/dashboard\u0000', D],
  ['encoded tab', '/%09/evil.com', D],
  ['encoded newline in query', '/settings?x=%0Aevil', D],
  ['unicode line separator', '/dashboard ', D],
  // dot segments and empty segments
  ['dot-dot then double slash', '/..//evil', D],
  ['traversal out of allowed', '/dashboard/../admin', D],
  ['encoded traversal', '/dashboard/%2e%2e/%2e%2e//evil.com', D],
  ['double-encoded traversal', '/dashboard/%252e%252e', D],
  ['single dot segment', '/dashboard/./x', D],
  ['empty middle segment', '/dashboard//evil.com', D],
  // malformed encoding / length
  ['malformed percent-encoding', '/dashboard/%E0%A4%A', D],
  ['overlong', '/dashboard/' + 'a'.repeat(3000), D],
];

describe('safeNextPath', () => {
  it('has at least 25 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(25);
  });

  it.each(cases)('%s: %j → %s', (_label, input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it('accepts every allow-listed segment exactly', () => {
    for (const segment of ALLOWED_NEXT_SEGMENTS) {
      expect(safeNextPath(`/${segment}`)).toBe(`/${segment}`);
      expect(safeNextPath(`/${segment}x`)).toBe(D);
    }
  });

  it('never returns something that resolves off-origin', () => {
    for (const [, input] of cases) {
      const resolved = new URL(safeNextPath(input), 'https://app.test/auth/callback');
      expect(resolved.origin).toBe('https://app.test');
    }
  });
});
