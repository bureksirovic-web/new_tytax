import { afterEach, describe, expect, it } from 'vitest';
import { ImportError, parseLegacyBackup, type ImportErrorCode } from '..';

function codeOf(fn: () => unknown): ImportErrorCode | 'no-throw' | 'other' {
  try {
    fn();
    return 'no-throw';
  } catch (e) {
    return e instanceof ImportError ? e.code : 'other';
  }
}

const minimalLog = { id: 1, date: '2025-01-01', session: 'A', exercises: [] };

function assertPrototypeClean(): void {
  const probe: Record<string, unknown> = {};
  expect(probe.polluted).toBeUndefined();
  expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false);
  expect(({} as { constructor: unknown }).constructor).toBe(Object);
}

afterEach(() => {
  // Defensive: a failing test must not leak pollution into other tests.
  delete (Object.prototype as Record<string, unknown>).polluted;
});

describe('legacy-import safety: size cap', () => {
  it('throws TOO_LARGE for a whole file over the cap, before parsing', () => {
    const text = JSON.stringify({ logs: [], pad: 'x'.repeat(2000) });
    expect(codeOf(() => parseLegacyBackup(text, { maxBytes: 1000 }))).toBe('TOO_LARGE');
    // Not even valid JSON: proves the size check runs before JSON.parse.
    expect(codeOf(() => parseLegacyBackup(`{${'x'.repeat(2000)}`, { maxBytes: 1000 }))).toBe('TOO_LARGE');
  });

  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    const text = JSON.stringify({ logs: [], n: 'č'.repeat(400) }); // ~800+ bytes, ~415 chars
    expect(text.length).toBeLessThan(500);
    expect(codeOf(() => parseLegacyBackup(text, { maxBytes: 500 }))).toBe('TOO_LARGE');
    expect(codeOf(() => parseLegacyBackup(JSON.stringify({ logs: [], e: '😀'.repeat(10) }), { maxBytes: 45 }))).toBe('TOO_LARGE');
  });

  it('throws TOO_LARGE for a nested localStorage string over the cap', () => {
    const dump = { tytax_logs: JSON.stringify([{ ...minimalLog, notes: 'y'.repeat(3000) }]) };
    expect(codeOf(() => parseLegacyBackup(dump, { maxBytes: 1000 }))).toBe('TOO_LARGE');
  });

  it('throws TOO_LARGE when nested strings together exceed the cap', () => {
    const chunk = 'z'.repeat(400);
    const dump = { tytax_start_date: chunk, tytax_warmup_strategy: chunk, tytax_language: chunk };
    expect(codeOf(() => parseLegacyBackup(dump, { maxBytes: 1000 }))).toBe('TOO_LARGE');
  });

  it('accepts input under the default 20 MiB cap', () => {
    expect(parseLegacyBackup(JSON.stringify({ logs: [minimalLog] })).users[0]?.logs).toHaveLength(1);
  });
});

describe('legacy-import safety: JSON and format errors', () => {
  it('throws INVALID_JSON for malformed text', () => {
    expect(codeOf(() => parseLegacyBackup('{"logs": ['))).toBe('INVALID_JSON');
    expect(codeOf(() => parseLegacyBackup(''))).toBe('INVALID_JSON');
  });

  it('throws UNRECOGNIZED_FORMAT for non-TYTAX JSON', () => {
    expect(codeOf(() => parseLegacyBackup('{"hello": 1}'))).toBe('UNRECOGNIZED_FORMAT');
    expect(codeOf(() => parseLegacyBackup('[1,2,3]'))).toBe('UNRECOGNIZED_FORMAT');
    expect(codeOf(() => parseLegacyBackup('null'))).toBe('UNRECOGNIZED_FORMAT');
    expect(codeOf(() => parseLegacyBackup(42))).toBe('UNRECOGNIZED_FORMAT');
  });

  it('throws INVALID_STRUCTURE when a backup has logs/sessionOrder of the wrong type', () => {
    expect(codeOf(() => parseLegacyBackup({ logs: { a: 1 } }))).toBe('INVALID_STRUCTURE');
    expect(codeOf(() => parseLegacyBackup({ logs: [], sessionOrder: 'Upper A' }))).toBe('INVALID_STRUCTURE');
    expect(codeOf(() => parseLegacyBackup({ logs: null }))).toBe('INVALID_STRUCTURE');
  });

  it('throws INVALID_STRUCTURE for non-JSON values in pre-parsed input', () => {
    expect(codeOf(() => parseLegacyBackup({ logs: [], f: () => 1 }))).toBe('INVALID_STRUCTURE');
  });

  it('the error carries name, message and path', () => {
    try {
      parseLegacyBackup({ logs: 'nope' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).name).toBe('ImportError');
      expect((e as ImportError).path).toBe('logs');
    }
  });
});

describe('legacy-import safety: prototype pollution', () => {
  const payload = '{"logs":[{"id":1,"date":"2025-01-01","session":"A","exercises":[],"__proto__":{"polluted":"yes"}}],' +
    '"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},' +
    '"trainingPlan":{"A":["x"],"prototype":{"polluted":"yes"}}}';

  it('strips __proto__/constructor/prototype at any depth with warnings (default)', () => {
    const bundle = parseLegacyBackup(payload);
    assertPrototypeClean();
    const stripped = bundle.warnings.filter((w) => w.code === 'UNSAFE_KEY_STRIPPED').map((w) => w.path);
    expect(stripped).toEqual(['logs[0].__proto__', '__proto__', 'constructor', 'trainingPlan.prototype']);
    expect(bundle.users[0]?.trainingPlan).toEqual({ A: ['x'] });
    expect(Object.getPrototypeOf(bundle.users[0]?.trainingPlan)).toBe(Object.prototype);
  });

  it('strips payloads hidden inside nested localStorage strings', () => {
    const inner = '[{"id":1,"date":"2025-01-01","session":"A","exercises":[{"name":"X","sets":[{"kg":1,"reps":1,"done":true,"__proto__":{"polluted":"yes"}}]}]}]';
    const bundle = parseLegacyBackup(JSON.stringify({ tytax_logs: inner, tytax_training_plan: '{"__proto__":{"polluted":1}}' }));
    assertPrototypeClean();
    expect(bundle.warnings.map((w) => w.path)).toEqual(['tytax_logs[0].exercises[0].sets[0].__proto__', 'tytax_training_plan.__proto__']);
    expect(bundle.users[0]?.logs[0]?.exercises[0]?.sets).toHaveLength(1);
  });

  it('never copies an inherited prototype from pre-parsed input', () => {
    const evil: unknown = JSON.parse(payload);
    const bundle = parseLegacyBackup(evil);
    assertPrototypeClean();
    const withProto = Object.create({ polluted: 'yes' }) as Record<string, unknown>;
    withProto.logs = [];
    parseLegacyBackup(withProto);
    assertPrototypeClean();
    expect(bundle.users).toHaveLength(1);
  });

  it("throws UNSAFE_KEYS in unsafeKeys: 'throw' mode", () => {
    expect(codeOf(() => parseLegacyBackup(payload, { unsafeKeys: 'throw' }))).toBe('UNSAFE_KEYS');
    assertPrototypeClean();
  });
});

describe('legacy-import safety: nesting depth', () => {
  it('rejects deeply nested JSON text before parsing', () => {
    const deep = `{"logs":[],"x":${'['.repeat(5000)}${']'.repeat(5000)}}`;
    expect(codeOf(() => parseLegacyBackup(deep))).toBe('TOO_LARGE');
    expect(codeOf(() => parseLegacyBackup(`{"logs":[],"x":${'['.repeat(10)}${']'.repeat(10)}}`, { maxDepth: 5 }))).toBe('TOO_LARGE');
  });

  it('ignores brackets inside strings (including escaped quotes)', () => {
    const text = JSON.stringify({ logs: [], note: `\\"${'['.repeat(200)}` });
    expect(parseLegacyBackup(text, { maxDepth: 5 }).format).toBe('app-backup');
  });

  it('rejects deeply nested pre-parsed input and cyclic objects', () => {
    let deep: unknown = [];
    for (let i = 0; i < 100; i++) deep = [deep];
    expect(codeOf(() => parseLegacyBackup({ logs: [], deep }))).toBe('TOO_LARGE');
    const cyclic: Record<string, unknown> = { logs: [] };
    cyclic.self = cyclic;
    expect(codeOf(() => parseLegacyBackup(cyclic))).toBe('TOO_LARGE');
  });
});
