import { describe, expect, it } from 'vitest';
import { encodeSetupPayload, parseSetupFragment, MAX_FRAGMENT_CHARS } from '../codec';
import { MAX_SETUP_PROFILES, type SetupPayload } from '../schema';

const CURRENT_YEAR = new Date().getFullYear();

/** base64url(text), independent of the module under test (for malformed payloads). */
function toFragment(text: string): string {
  const base64 = Buffer.from(text, 'utf-8').toString('base64url');
  return `#p=${base64}`;
}

const validPayload: SetupPayload = {
  v: 1,
  profiles: [
    { name: 'Ana', presetId: 'tytax-balanced-6day', language: 'hr' },
    { name: 'Leo', birthYear: CURRENT_YEAR - 11, experienceLevel: 'beginner', presetId: 'bw-fundamentals' },
  ],
};

describe('encodeSetupPayload', () => {
  it('produces a base64url string (no +, /, = or padding)', () => {
    const encoded = encodeSetupPayload(validPayload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
  });

  it('round-trips through parseSetupFragment', () => {
    const encoded = encodeSetupPayload(validPayload);
    const result = parseSetupFragment(`#p=${encoded}`);
    expect(result).toEqual({ ok: true, payload: validPayload });
  });
});

describe('parseSetupFragment: valid payloads', () => {
  it('parses a single profile with only the required fields', () => {
    const payload: SetupPayload = { v: 1, profiles: [{ name: 'Tomi', presetId: 'tytax-balanced-6day' }] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toEqual({ ok: true, payload });
  });

  it('parses the maximum of 6 profiles', () => {
    const payload: SetupPayload = {
      v: 1,
      profiles: Array.from({ length: MAX_SETUP_PROFILES }, (_, i) => ({
        name: `P${i}`,
        presetId: 'bw-fundamentals' as const,
      })),
    };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result.ok).toBe(true);
  });

  it('accepts a name with diacritics, apostrophe and hyphen after NFC normalisation', () => {
    // 'š' as NFD (s + combining caron) normalises to the NFC precomposed form.
    const nfdName = 'Ivan-Mário Kovač';
    const payload: SetupPayload = { v: 1, profiles: [{ name: nfdName, presetId: 'bw-fundamentals' }] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.profiles[0].name).toBe(nfdName.normalize('NFC'));
  });

  it('checks the 40-character limit on the NFC form, not the decomposed input', () => {
    // 40 x 'č': 40 code units in NFC, 80 when decomposed (c + combining caron).
    const nfc = 'č'.repeat(40);
    const nfd = nfc.normalize('NFD');
    expect(nfd.length).toBe(80);
    const ok = parseSetupFragment(`#p=${encodeSetupPayload({ v: 1, profiles: [{ name: nfd, presetId: 'bw-fundamentals' }] })}`);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.payload.profiles[0].name).toBe(nfc);
    const tooLong = parseSetupFragment(`#p=${encodeSetupPayload({ v: 1, profiles: [{ name: 'č'.repeat(41), presetId: 'bw-fundamentals' }] })}`);
    expect(tooLong.ok).toBe(false);
  });
});

describe('parseSetupFragment: rejections (AC2)', () => {
  it('rejects an unknown preset id', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', presetId: 'not-a-real-preset' }] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a name over 40 chars', () => {
    const payload = { v: 1, profiles: [{ name: 'A'.repeat(41), presetId: 'bw-fundamentals' }] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a name with disallowed characters', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana<script>', presetId: 'bw-fundamentals' }] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects 7 profiles', () => {
    const payload = {
      v: 1,
      profiles: Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, presetId: 'bw-fundamentals' })),
    };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects 0 profiles', () => {
    const payload = { v: 1, profiles: [] };
    const result = parseSetupFragment(`#p=${encodeSetupPayload(payload)}`);
    expect(result).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a payload whose raw fragment is over 4096 chars, before any decoding', () => {
    const hash = `#p=${'A'.repeat(MAX_FRAGMENT_CHARS + 10)}`;
    const result = parseSetupFragment(hash);
    expect(result).toEqual({ ok: false, error: 'too_long' });
  });

  it('rejects a __proto__ key (prototype pollution)', () => {
    const hash = toFragment('{"v":1,"profiles":[{"__proto__":{"polluted":true},"name":"Ana","presetId":"bw-fundamentals"}]}');
    const result = parseSetupFragment(hash);
    expect(result).toMatchObject({ ok: false, error: 'unsafe_key' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a constructor key', () => {
    const hash = toFragment('{"v":1,"profiles":[{"constructor":{"polluted":true},"name":"Ana","presetId":"bw-fundamentals"}]}');
    expect(parseSetupFragment(hash)).toMatchObject({ ok: false, error: 'unsafe_key' });
  });

  it('rejects a prototype key', () => {
    const hash = toFragment('{"v":1,"profiles":[{"prototype":{"polluted":true},"name":"Ana","presetId":"bw-fundamentals"}]}');
    expect(parseSetupFragment(hash)).toMatchObject({ ok: false, error: 'unsafe_key' });
  });

  it('rejects a non-JSON payload', () => {
    const hash = toFragment('this is not json');
    expect(parseSetupFragment(hash)).toMatchObject({ ok: false, error: 'bad_json' });
  });

  it('rejects bad base64 (invalid charset)', () => {
    expect(parseSetupFragment('#p=not!!valid==base64??')).toMatchObject({ ok: false, error: 'bad_base64' });
  });

  it('rejects a birthYear below 1920', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', birthYear: 1919, presetId: 'bw-fundamentals' }] };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a birthYear after the current year', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', birthYear: CURRENT_YEAR + 1, presetId: 'bw-fundamentals' }] };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a non-integer birthYear', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', birthYear: 1990.5, presetId: 'bw-fundamentals' }] };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects an unknown top-level key (strict schema)', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals' }], extra: true };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects an unknown profile-level key (strict schema)', () => {
    const payload = { v: 1, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals', extra: true }] };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a wrong version number', () => {
    const payload = { v: 2, profiles: [{ name: 'Ana', presetId: 'bw-fundamentals' }] };
    expect(parseSetupFragment(`#p=${encodeSetupPayload(payload)}`)).toMatchObject({ ok: false, error: 'invalid_schema' });
  });

  it('rejects a hash with no p= payload', () => {
    expect(parseSetupFragment('#')).toEqual({ ok: false, error: 'missing_payload' });
    expect(parseSetupFragment('#other=1')).toEqual({ ok: false, error: 'missing_payload' });
    expect(parseSetupFragment('')).toEqual({ ok: false, error: 'missing_payload' });
  });
});
