import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildUrl, DEFAULT_ORIGIN, encodePayload, MAX_FRAGMENT_CHARS, parseArgs, SetupLinkError, validate } from '../setup-link.mjs';

const SCRIPT = join(__dirname, '..', 'setup-link.mjs');

/** Runs the real CLI: JSON on stdin, optional extra argv. */
function run(stdin: string, args: string[] = []): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { input: stdin, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

const validPayload = { v: 1, profiles: [{ name: 'Tomi', presetId: 'tytax-balanced-6day' }] };

describe('setup-link.mjs CLI', () => {
  it('reads JSON from stdin and prints a link at the default origin', () => {
    const { status, stdout } = run(JSON.stringify(validPayload));
    expect(status).toBe(0);
    expect(stdout).toBe(`${DEFAULT_ORIGIN}/setup#p=${encodePayload(validPayload)}`);
  });

  it('honours --origin', () => {
    const { status, stdout } = run(JSON.stringify(validPayload), ['--origin', 'https://staging.example']);
    expect(status).toBe(0);
    expect(stdout).toBe(`https://staging.example/setup#p=${encodePayload(validPayload)}`);
  });

  it('never reads the payload from argv (only stdin)', () => {
    // Passing JSON as an argv arg (not --origin) must not be treated as the payload.
    const { status, stderr } = run('', [JSON.stringify(validPayload)]);
    expect(status).toBe(1);
    expect(stderr).toContain('no JSON on stdin');
  });

  it('rejects non-JSON stdin with exit code 1', () => {
    const { status, stderr } = run('not json');
    expect(status).toBe(1);
    expect(stderr).toContain('invalid JSON');
  });

  it('rejects an invalid payload (bad version) with exit code 1', () => {
    const { status, stderr } = run(JSON.stringify({ v: 2, profiles: [] }));
    expect(status).toBe(1);
    expect(stderr).toContain('"v" must be 1');
  });
});

describe('validate', () => {
  it('accepts a minimal valid payload', () => {
    expect(() => validate(validPayload)).not.toThrow();
  });

  it('rejects 7 profiles', () => {
    const profiles = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, presetId: 'bw-fundamentals' }));
    expect(() => validate({ v: 1, profiles })).toThrow(SetupLinkError);
  });

  it('rejects a birthYear out of range', () => {
    expect(() => validate({ v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals', birthYear: 1900 }] })).toThrow(SetupLinkError);
  });

  it('rejects a bad experienceLevel', () => {
    expect(() =>
      validate({ v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals', experienceLevel: 'expert' }] }),
    ).toThrow(SetupLinkError);
  });

  it('rejects a name with disallowed characters', () => {
    expect(() => validate({ v: 1, profiles: [{ name: 'Ana<script>', presetId: 'bw-fundamentals' }] })).toThrow(SetupLinkError);
  });
});

describe('parseArgs', () => {
  it('defaults to DEFAULT_ORIGIN', () => {
    expect(parseArgs([])).toEqual({ origin: DEFAULT_ORIGIN });
  });

  it('reads --origin', () => {
    expect(parseArgs(['--origin', 'https://x.example'])).toEqual({ origin: 'https://x.example' });
  });
});

describe('buildUrl', () => {
  it('rejects a payload whose fragment would be over the cap', () => {
    const huge = { v: 1, profiles: [{ name: 'A'.repeat(40), presetId: 'x'.repeat(MAX_FRAGMENT_CHARS) }] };
    expect(() => buildUrl(huge, DEFAULT_ORIGIN)).toThrow(SetupLinkError);
  });
});
