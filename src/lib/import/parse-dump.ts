/**
 * localStorage dump ({ key: stringValue } or already-parsed values) -> users.
 *
 * User resolution:
 * - users = tytax_users_list (in list order) + users discovered from key
 *   suffixes that are not in the list (sorted, warned USER_NOT_IN_LIST).
 * - No users at all: legacy single-user data, un-suffixed keys -> 'default'.
 * - Users exist: un-suffixed per-user keys are pre-migration leftovers (the
 *   legacy migration copied them to the first user without deleting them) and
 *   are ignored with LEGACY_LEFTOVER_IGNORED. Un-suffixed
 *   tytax_custom_protocols goes to shared.customProtocols (the legacy app wrote
 *   it un-suffixed by mistake), and un-suffixed bar weight / language go to
 *   shared.settings (they are device-global in the legacy app).
 */
import { buildUser, emptySource, type RawField, type RawUserSource } from './build-user';
import { ImportError } from './errors';
import { GLOBAL_ONLY_BASES, SHARED_SETTING_BASES, matchKey, type KeySpec } from './keys';
import { normalizeProtocols, normalizeStringList } from './normalize-user';
import { safeParseJson, utf8ByteLength, type SafeJsonContext } from './safe-json';
import { applySetting } from './settings';
import type { ImportWarning, LegacySharedData, LegacyUserData } from './types';
import { DEFAULT_USERNAME } from './types';

interface Budget {
  used: number;
}

function decode(raw: unknown, spec: KeySpec, key: string, ctx: SafeJsonContext, budget: Budget): unknown {
  if (typeof raw !== 'string') return raw;
  budget.used += utf8ByteLength(raw, ctx.maxBytes + 1);
  if (budget.used > ctx.maxBytes) {
    throw new ImportError('TOO_LARGE', `Nested values exceed the ${ctx.maxBytes}-byte limit`, key);
  }
  const looksJson = spec.encoding === 'json' || raw.startsWith('"');
  if (!looksJson) return raw;
  try {
    return safeParseJson(raw, ctx, key);
  } catch (e) {
    if (e instanceof ImportError && e.code === 'INVALID_JSON') {
      if (spec.encoding === 'raw') return raw;
      ctx.warnings.push({ code: 'INVALID_JSON_VALUE', path: key, message: 'Skipped: value is not valid JSON' });
      return undefined;
    }
    throw e;
  }
}

function assign(src: RawUserSource, spec: KeySpec, field: RawField): void {
  const t = spec.target;
  if (typeof t === 'object') src.settings[t.setting] = field;
  else if (t !== 'ignored' && t !== 'usersList') src[t] = field;
}

interface Buckets {
  global: Map<string, RawField>;
  perUser: Map<string, RawUserSource>;
}

function collect(dump: Record<string, unknown>, ctx: SafeJsonContext): Buckets {
  const buckets: Buckets = { global: new Map(), perUser: new Map() };
  const budget: Budget = { used: 0 };
  for (const key of Object.keys(dump)) {
    if (!key.startsWith('tytax_')) continue;
    const match = matchKey(key);
    const isGlobalSuffixed = match?.user !== undefined && GLOBAL_ONLY_BASES.has(match.base);
    if (!match || isGlobalSuffixed) {
      ctx.warnings.push({ code: 'UNKNOWN_KEY', path: key, message: 'Unknown legacy key ignored' });
      continue;
    }
    if (match.user === '') {
      ctx.warnings.push({ code: 'EMPTY_USERNAME', path: key, message: 'Key with empty username ignored' });
      continue;
    }
    const value = decode(dump[key], match.spec, key, ctx, budget);
    if (value === undefined) continue;
    const field: RawField = { value, path: key };
    if (match.user === undefined) {
      buckets.global.set(match.base, field);
      continue;
    }
    const src = buckets.perUser.get(match.user) ?? emptySource();
    assign(src, match.spec, field);
    buckets.perUser.set(match.user, src);
  }
  return buckets;
}

function resolveUsernames(buckets: Buckets, warnings: ImportWarning[]): string[] {
  const listField = buckets.global.get('tytax_users_list');
  const listed = listField ? normalizeStringList(listField.value, listField.path, warnings, (s) => s.trim()) : [];
  const names = [...new Set(listed)];
  const discovered = [...buckets.perUser.keys()].filter((u) => !names.includes(u)).sort();
  if (listField) {
    for (const u of discovered) {
      warnings.push({ code: 'USER_NOT_IN_LIST', path: 'tytax_users_list', message: `User "${u}" has data but is not listed` });
    }
  }
  return [...names, ...discovered];
}

export interface DumpResult {
  users: LegacyUserData[];
  shared: LegacySharedData;
}

export function parseDump(dump: Record<string, unknown>, ctx: SafeJsonContext): DumpResult {
  const warnings = ctx.warnings;
  const buckets = collect(dump, ctx);
  const names = resolveUsernames(buckets, warnings);
  const shared: LegacySharedData = { customProtocols: [], settings: {} };

  if (names.length === 0) {
    const src = emptySource();
    for (const [base, field] of buckets.global) {
      const spec = matchKey(base)?.spec;
      if (spec) assign(src, spec, field);
    }
    const hasData = [...buckets.global.keys()].some((b) => b !== 'tytax_users_list');
    return { users: hasData ? [buildUser(DEFAULT_USERNAME, src, warnings)] : [], shared };
  }

  for (const [base, field] of buckets.global) {
    if (base === 'tytax_users_list') continue;
    if (base === 'tytax_custom_protocols') {
      warnings.push({
        code: 'SHARED_CUSTOM_PROTOCOLS',
        path: base,
        message: 'Un-suffixed custom protocols cannot be attributed to one user; imported as shared',
      });
      shared.customProtocols = normalizeProtocols(field.value, field.path, warnings);
    } else if (SHARED_SETTING_BASES.has(base)) {
      const setting = base === 'tytax_bar_weight' ? 'barWeightKg' : 'language';
      applySetting(shared.settings, setting, field.value, field.path, warnings);
    } else {
      warnings.push({ code: 'LEGACY_LEFTOVER_IGNORED', path: base, message: 'Pre-migration single-user value ignored' });
    }
  }
  const users = names.map((name) => buildUser(name, buckets.perUser.get(name) ?? emptySource(), warnings));
  return { users, shared };
}
