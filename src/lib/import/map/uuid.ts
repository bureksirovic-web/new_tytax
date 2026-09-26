/** Deterministic RFC 4122 version-5 UUIDs (SHA-1, name-based) for idempotent re-import. */
import { sha1, toHex } from './sha1';

/**
 * Namespace of every id the legacy import derives. Fixed forever: changing it
 * would make a re-import create duplicates instead of overwriting.
 */
export const LEGACY_IMPORT_NAMESPACE = '8d3c5f0e-2b7a-4e61-9f4d-6a1b2c3d4e5f';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UUID_V5_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function uuidBytes(uuid: string): Uint8Array {
  if (!UUID_RE.test(uuid)) throw new Error(`Invalid namespace uuid: ${uuid}`);
  const hex = uuid.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** RFC 4122 §4.3 name-based UUID, version 5. */
export function uuidV5(name: string, namespace: string): string {
  const ns = uuidBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(ns.length + nameBytes.length);
  input.set(ns);
  input.set(nameBytes, ns.length);
  const hash = sha1(input).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = toHex(hash);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type ImportIdKind = 'log' | 'session-exercise' | 'set' | 'bodyweight' | 'program' | 'program-session';

/** Id of one imported record: v5 over `${profileId}|${kind}|${sourceKey}`. */
export function importId(profileId: string, kind: ImportIdKind, sourceKey: string): string {
  return uuidV5(`${profileId}|${kind}|${sourceKey}`, LEGACY_IMPORT_NAMESPACE);
}
