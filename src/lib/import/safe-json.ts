/**
 * Defensive JSON handling for untrusted backup files.
 *
 * - Byte cap is checked BEFORE JSON.parse (UTF-8 length, early exit).
 * - Nesting depth is checked by a linear bracket scan BEFORE JSON.parse, and
 *   again while walking already-parsed values.
 * - Prototype pollution: JSON.parse creates OWN "__proto__" properties, which
 *   become dangerous once code copies them with assignment/spread. Every value
 *   is rebuilt by a post-walk into fresh plain objects that never carry the keys
 *   "__proto__", "constructor" or "prototype". Policy (documented choice):
 *   default 'strip' drops the key and records an UNSAFE_KEY_STRIPPED warning,
 *   so a backup with one poisoned field still imports; 'throw' raises
 *   ImportError('UNSAFE_KEYS') instead.
 */
import { ImportError } from './errors';
import type { ImportWarning, ParseOptions } from './types';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH } from './types';

export const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

export interface SafeJsonContext {
  maxBytes: number;
  maxDepth: number;
  unsafeKeys: 'strip' | 'throw';
  warnings: ImportWarning[];
}

export function createContext(opts: ParseOptions = {}, warnings: ImportWarning[] = []): SafeJsonContext {
  return {
    maxBytes: opts.maxBytes ?? DEFAULT_MAX_BYTES,
    maxDepth: opts.maxDepth ?? DEFAULT_MAX_DEPTH,
    unsafeKeys: opts.unsafeKeys ?? 'strip',
    warnings,
  };
}

/** UTF-8 byte length of a JS string, stopping as soon as it exceeds `limit`. */
export function utf8ByteLength(text: string, limit = Number.POSITIVE_INFINITY): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > limit) return bytes;
  }
  return bytes;
}

export function assertWithinBytes(text: string, maxBytes: number, path: string): void {
  // Every UTF-16 code unit encodes to at least one UTF-8 byte: cheap reject first.
  const tooLarge = text.length > maxBytes || utf8ByteLength(text, maxBytes) > maxBytes;
  if (tooLarge) {
    throw new ImportError('TOO_LARGE', `Input exceeds the ${maxBytes}-byte limit`, path);
  }
}

/** Linear scan of JSON text: throws TOO_LARGE when brackets nest deeper than maxDepth. */
export function assertJsonDepth(text: string, maxDepth: number, path: string): void {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') {
      depth++;
      if (depth > maxDepth) {
        throw new ImportError('TOO_LARGE', `JSON nesting exceeds depth ${maxDepth}`, path);
      }
    } else if (ch === '}' || ch === ']') depth--;
  }
}

function unsafeKey(ctx: SafeJsonContext, path: string, key: string): void {
  if (ctx.unsafeKeys === 'throw') {
    throw new ImportError('UNSAFE_KEYS', `Forbidden key "${key}"`, path);
  }
  ctx.warnings.push({ code: 'UNSAFE_KEY_STRIPPED', path, message: `Forbidden key "${key}" was removed` });
}

function childPath(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

/**
 * Deep-copies a JSON-like value into fresh arrays/plain objects, dropping
 * forbidden keys, enforcing maxDepth and rejecting non-JSON values.
 */
export function sanitize(value: unknown, ctx: SafeJsonContext, path = '', depth = 1): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value !== 'object') {
    throw new ImportError('INVALID_STRUCTURE', `Unsupported value of type ${typeof value}`, path);
  }
  if (depth > ctx.maxDepth) {
    throw new ImportError('TOO_LARGE', `Nesting exceeds depth ${ctx.maxDepth}`, path);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown, i) => sanitize(item, ctx, childPath(path, i), depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const keyPath = childPath(path, key);
    if (UNSAFE_KEYS.has(key)) {
      unsafeKey(ctx, keyPath, key);
      continue;
    }
    const child: unknown = (value as Record<string, unknown>)[key];
    if (child === undefined) continue;
    out[key] = sanitize(child, ctx, keyPath, depth + 1);
  }
  return out;
}

/** Size cap, depth guard, JSON.parse, then sanitizing post-walk. */
export function safeParseJson(text: string, ctx: SafeJsonContext, path = ''): unknown {
  assertWithinBytes(text, ctx.maxBytes, path);
  assertJsonDepth(text, ctx.maxDepth, path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'parse error';
    throw new ImportError('INVALID_JSON', `Invalid JSON: ${reason}`, path);
  }
  return sanitize(parsed, ctx, path);
}
