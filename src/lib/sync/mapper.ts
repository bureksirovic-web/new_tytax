/**
 * camelCase record ↔ snake_case wire row, per docs/v2/sync-schema.md.
 *
 * - Known fields use the explicit maps in ./columns; every other camelCase
 *   field travels in `extra` (jsonb) and comes back on pull.
 * - `syncedAt` is local-only and never sent.
 * - Push: `undefined` → `null`. Pull: `null` → absent key, except
 *   `activeProgramId`, which stays `null`.
 * - Ids (record, owner, FK) must be RFC 4122 uuids; anything else throws
 *   `SyncMapError('invalid_id')` so a `local` id never reaches the wire.
 */
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { SyncTable } from '@/contracts/sync';
import { TABLE_SPECS, TIMESTAMP_COLUMNS, type TableSpec } from './columns';

export type RemoteRow = Record<string, unknown>;
export type LocalRecord = Record<string, unknown>;

export type SyncMapErrorCode = 'invalid_id' | 'account_mismatch';

export class SyncMapError extends Error {
  readonly code: SyncMapErrorCode;
  readonly field: string;

  constructor(code: SyncMapErrorCode, field: string) {
    super(`sync mapper: ${code} (${field})`);
    this.name = 'SyncMapError';
    this.code = code;
    this.field = field;
  }
}

/** RFC 4122 / 9562 uuid, versions 1–8, variant 10xx. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function requireUuid(v: unknown, field: string): string {
  if (!isUuid(v)) throw new SyncMapError('invalid_id', field);
  return v;
}

const LOCAL_ONLY = new Set(['syncedAt']);

/**
 * Fields that must never reach the wire, not even through `extra`'s jsonb
 * fallback (family-profiles plan: a child's birth year is local-only data).
 * Checked on both directions, so a legacy remote row cannot reintroduce one.
 */
const NEVER_SYNC = new Set(['birthYear']);

const knownCache = new Map<SyncTable, ReadonlySet<string>>();

/** Every camelCase key the table map owns (never copied into or out of `extra`). */
function knownKeys(table: SyncTable, spec: TableSpec): ReadonlySet<string> {
  let known = knownCache.get(table);
  if (!known) {
    known = new Set(['id', spec.owner === 'account' ? 'accountId' : 'profileId', ...LOCAL_ONLY, ...spec.columns.map(([c]) => c)]);
    knownCache.set(table, known);
  }
  return known;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeTimestamp(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : v;
}

/** Local record → wire row for `upsert`. */
export function toRemote(table: SyncTable, record: LocalRecord, accountId: string): RemoteRow {
  const spec = TABLE_SPECS[table];
  const row: RemoteRow = { id: requireUuid(record.id, 'id'), profile_id: requireUuid(accountId, 'accountId') };
  if (spec.owner === 'member') {
    row.family_member_id = requireUuid(record.profileId, 'profileId');
  } else if (record.accountId !== undefined && record.accountId !== accountId) {
    throw new SyncMapError('account_mismatch', 'accountId');
  }
  for (const [camel, snake] of spec.columns) {
    const v = record[camel];
    row[snake] = v === undefined ? null : v;
  }
  for (const fk of spec.fkIds) {
    const v = record[fk];
    if (v !== undefined && v !== null) requireUuid(v, fk);
  }
  const known = knownKeys(table, spec);
  const extra: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(record)) {
    if (!known.has(key) && v !== undefined && !NEVER_SYNC.has(key)) extra[key] = v;
  }
  row.extra = extra;
  return row;
}

/** Wire row from `pull` → local record for `Repository.applyRemote`. */
export function fromRemote(table: SyncTable, row: RemoteRow): LocalRecord {
  const spec = TABLE_SPECS[table];
  const out: LocalRecord = { id: requireUuid(row.id, 'id') };
  if (spec.owner === 'member') {
    out.profileId = requireUuid(row.family_member_id, 'family_member_id');
  } else if (row.profile_id !== null && row.profile_id !== undefined) {
    out.accountId = requireUuid(row.profile_id, 'profile_id');
  }
  for (const [camel, snake] of spec.columns) {
    const v = row[snake];
    if (v === null || v === undefined) {
      if (camel === 'activeProgramId') out[camel] = null;
      continue;
    }
    out[camel] = TIMESTAMP_COLUMNS.has(snake) ? normalizeTimestamp(v) : v;
  }
  for (const fk of spec.fkIds) {
    const v = out[fk];
    if (v !== undefined && v !== null) requireUuid(v, fk);
  }
  if (isPlainObject(row.extra)) {
    const known = knownKeys(table, spec);
    for (const [key, v] of Object.entries(row.extra)) {
      if (!known.has(key) && !(key in out) && !NEVER_SYNC.has(key)) out[key] = v;
    }
  }
  if (table === 'profiles') {
    // Legacy rows carry `settings = {}`; the app needs a complete ProfileSettings.
    const settings = isPlainObject(out.settings) ? out.settings : {};
    out.settings = { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg], ...settings };
  }
  return out;
}
