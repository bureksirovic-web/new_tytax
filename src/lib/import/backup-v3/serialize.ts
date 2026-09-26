/**
 * serializeBackupV3: BackupV3 -> JSON text with a stable (sorted) key order at
 * every object level, so the same data always yields byte-identical output
 * regardless of the insertion order the repository produced. Array order is
 * kept. `undefined` optional fields are omitted (plain JSON semantics).
 */
import type { BackupV3 } from '@/contracts';

export interface SerializeBackupOptions {
  /** Indent with two spaces for a human-readable file. Default false (compact). */
  pretty?: boolean;
}

function sortedKeys(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src).sort()) {
    Object.defineProperty(out, k, { value: src[k], enumerable: true, writable: true, configurable: true });
  }
  return out;
}

export function serializeBackupV3(backup: BackupV3, opts: SerializeBackupOptions = {}): string {
  return JSON.stringify(backup, sortedKeys, opts.pretty ? 2 : undefined);
}
