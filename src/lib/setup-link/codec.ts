/**
 * Setup-link codec: base64url(JSON) in the URL fragment (`#p=<payload>`).
 * Browsers never send the fragment to the server, so it never reaches a log.
 *
 * `parseSetupFragment` is defence-in-depth on purpose: a raw-length cap before
 * any decoding, a base64url charset check, a JSON reviver that refuses
 * `__proto__`/`constructor`/`prototype` keys (prototype pollution), then a
 * strict zod schema (see schema.ts).
 */
import { setupPayloadSchema, type SetupPayload } from './schema';

/** Raw fragment string cap, checked before any decoding (amendments after 1b). */
export const MAX_FRAGMENT_CHARS = 4096;

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type SetupParseError =
  | 'too_long'
  | 'missing_payload'
  | 'bad_base64'
  | 'bad_json'
  | 'unsafe_key'
  | 'invalid_schema';

export type ParseSetupFragmentResult =
  | { ok: true; payload: SetupPayload }
  | { ok: false; error: SetupParseError; details?: string };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 =
    typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary =
    typeof globalThis.atob === 'function' ? globalThis.atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** base64url(JSON.stringify(payload)); no padding characters. */
export function encodeSetupPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

interface SafeJsonResult {
  ok: boolean;
  value?: unknown;
  unsafeKey?: boolean;
}

/** `JSON.parse` with a reviver that refuses `__proto__`/`constructor`/`prototype` keys at any depth. */
function safeJsonParse(text: string): SafeJsonResult {
  let unsafeKey = false;
  try {
    const value: unknown = JSON.parse(text, (key, val) => {
      if (DANGEROUS_KEYS.has(key)) {
        unsafeKey = true;
        throw new Error(`unsafe key: ${key}`);
      }
      return val;
    });
    return { ok: true, value };
  } catch {
    return { ok: false, unsafeKey };
  }
}

/**
 * Parses `location.hash` (e.g. `#p=<base64url>`). Nothing is written by a
 * failed parse; the caller decides what "invalid" shows.
 */
export function parseSetupFragment(hash: string): ParseSetupFragmentResult {
  if (typeof hash !== 'string' || hash.length > MAX_FRAGMENT_CHARS) {
    return { ok: false, error: 'too_long' };
  }
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (withoutHash.length === 0) return { ok: false, error: 'missing_payload' };
  const raw = new URLSearchParams(withoutHash).get('p');
  if (raw === null || raw === '') return { ok: false, error: 'missing_payload' };
  if (!BASE64URL_RE.test(raw)) return { ok: false, error: 'bad_base64' };

  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(raw));
  } catch {
    return { ok: false, error: 'bad_base64' };
  }

  const parsed = safeJsonParse(json);
  if (!parsed.ok) return { ok: false, error: parsed.unsafeKey ? 'unsafe_key' : 'bad_json' };

  const result = setupPayloadSchema.safeParse(parsed.value);
  if (!result.success) return { ok: false, error: 'invalid_schema', details: result.error.message };
  return { ok: true, payload: result.data };
}
