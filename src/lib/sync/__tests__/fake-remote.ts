/**
 * In-memory RemoteStore with the server semantics of migrations 002/003:
 * server-set `updated_at` (from a fake clock, microsecond strings), sticky
 * tombstones, immutable `profile_id`, RLS-like account checks, NOT NULL
 * owner columns and same-account composite FKs. Upserts are all-or-nothing.
 */
import type { RemoteError } from '../errors';
import type { RemoteRow } from '../mapper';
import type { AuthChangeListener, PullResult, RemoteStore, UndeleteResult, UpsertResult } from '../remote';

const FKS: Record<string, Array<[column: string, parent: string]>> = {
  family_members: [['active_program_id', 'programs']],
  programs: [['family_member_id', 'family_members']],
  workout_logs: [['family_member_id', 'family_members'], ['program_id', 'programs']],
  pr_records: [['family_member_id', 'family_members'], ['workout_log_id', 'workout_logs']],
  bodyweight_entries: [['family_member_id', 'family_members']],
  exercise_notes: [['family_member_id', 'family_members']],
  arsenal: [['family_member_id', 'family_members']],
  equipment: [['family_member_id', 'family_members']],
};

interface Failure {
  op: 'upsert' | 'pull' | 'undelete';
  table?: string;
  error: RemoteError;
  times: number;
}

/** Microseconds since epoch from a timestamptz string ('Z' or '+00:00', up to 6 fraction digits). */
export function micros(ts: string): number {
  const frac = /\.(\d+)/.exec(ts)?.[1] ?? '';
  return Date.parse(ts) * 1000 + Number(frac.padEnd(6, '0').slice(3, 6));
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class FakeRemoteStore implements RemoteStore {
  readonly tables = new Map<string, Map<string, RemoteRow>>();
  readonly calls: Array<{ op: 'upsert' | 'pull' | 'undelete'; table: string; rows: number; bytes?: number }> = [];
  private account: string | null;
  private clockMs: number;
  private tick = 0;
  private failures: Failure[] = [];
  private listeners = new Set<AuthChangeListener>();

  constructor(opts: { account?: string | null; start?: Date } = {}) {
    this.account = opts.account ?? null;
    this.clockMs = (opts.start ?? new Date(Date.UTC(2026, 2, 2, 12))).getTime();
  }

  /** Moves the server clock (for LWW scenarios). */
  advance(ms: number): void {
    this.clockMs += ms;
  }

  signIn(accountId: string | null, event = 'SIGNED_IN'): void {
    this.account = accountId;
    for (const l of this.listeners) l(event, accountId);
  }

  failNext(op: Failure['op'], error: RemoteError, opts: { table?: string; times?: number } = {}): void {
    this.failures.push({ op, error, table: opts.table, times: opts.times ?? 1 });
  }

  rows(table: string): RemoteRow[] {
    return [...(this.tables.get(table)?.values() ?? [])].map(clone);
  }

  row(table: string, id: string): RemoteRow | undefined {
    const r = this.tables.get(table)?.get(id);
    return r ? clone(r) : undefined;
  }

  private table(name: string): Map<string, RemoteRow> {
    let t = this.tables.get(name);
    if (!t) this.tables.set(name, (t = new Map()));
    return t;
  }

  private stamp(): string {
    this.tick += 1;
    this.clockMs += 1;
    const iso = new Date(this.clockMs).toISOString();
    return `${iso.slice(0, 23)}${String(this.tick % 1000).padStart(3, '0')}+00:00`;
  }

  private injected(op: Failure['op'], table: string): RemoteError | null {
    const f = this.failures.find((x) => x.op === op && (x.table === undefined || x.table === table));
    if (!f) return null;
    f.times -= 1;
    if (f.times <= 0) this.failures.splice(this.failures.indexOf(f), 1);
    return f.error;
  }

  async upsert(table: string, input: readonly RemoteRow[]): Promise<UpsertResult> {
    this.calls.push({ op: 'upsert', table, rows: input.length, bytes: new TextEncoder().encode(JSON.stringify(input)).length });
    const fail = (code: string): UpsertResult => ({ ok: false, error: { code, retryable: false } });
    const injected = this.injected('upsert', table);
    if (injected) return { ok: false, error: injected };
    if (!this.account) return { ok: false, error: { code: 'auth_required', retryable: false, authRequired: true } };
    const staged = new Map(this.table(table));
    const touched: RemoteRow[] = [];
    for (const raw of clone(input)) {
      const row: RemoteRow = { profile_id: this.account, ...raw };
      const id = String(row.id);
      const old = staged.get(id);
      if (row.profile_id !== this.account || (old && old.profile_id !== this.account)) return fail('42501');
      if (table !== 'family_members' && !row.family_member_id) return fail('23502');
      if (row.extra === null) return fail('23502');
      const next: RemoteRow = old ? { ...old, ...row } : { extra: {}, ...row };
      if (old) next.created_at = old.created_at;
      else next.created_at ??= new Date(this.clockMs).toISOString();
      if (old?.deleted_at && !row.deleted_at) next.deleted_at = old.deleted_at;
      next.updated_at = this.stamp();
      staged.set(id, next);
      touched.push(next);
    }
    for (const row of touched) {
      for (const [col, parent] of FKS[table] ?? []) {
        const ref = row[col];
        if (ref === null || ref === undefined) continue;
        const p = parent === table ? staged.get(String(ref)) : this.tables.get(parent)?.get(String(ref));
        if (!p || p.profile_id !== row.profile_id) return fail('23503');
      }
    }
    this.tables.set(table, staged);
    return {
      ok: true,
      rows: touched.map((r) => ({ id: String(r.id), updated_at: String(r.updated_at), deleted_at: (r.deleted_at as string | null | undefined) ?? null })),
    };
  }

  /** `public.undelete_row`: clears a tombstone of the caller's own row (RLS), bumps updated_at. */
  async undelete(table: string, id: string): Promise<UndeleteResult> {
    this.calls.push({ op: 'undelete', table, rows: 1 });
    const injected = this.injected('undelete', table);
    if (injected) return { ok: false, error: injected };
    if (!this.account) return { ok: false, error: { code: 'auth_required', retryable: false, authRequired: true } };
    const row = this.tables.get(table)?.get(id);
    if (!row || row.profile_id !== this.account || !row.deleted_at) return { ok: true, restored: false };
    row.deleted_at = null;
    row.updated_at = this.stamp();
    return { ok: true, restored: true };
  }

  async pull(table: string, since: string | null, afterId: string | null, limit: number): Promise<PullResult> {
    const injected = this.injected('pull', table);
    this.calls.push({ op: 'pull', table, rows: 0 });
    if (injected) return { ok: false, error: injected };
    if (!this.account) return { ok: false, error: { code: 'auth_required', retryable: false, authRequired: true } };
    const s = since === null ? null : micros(since);
    const rows = [...this.table(table).values()]
      .filter((r) => r.profile_id === this.account)
      .filter((r) => {
        if (s === null) return true;
        const t = micros(String(r.updated_at));
        return afterId === null ? t >= s : t > s || (t === s && String(r.id) > afterId);
      })
      .sort((a, b) => micros(String(a.updated_at)) - micros(String(b.updated_at)) || (String(a.id) < String(b.id) ? -1 : 1))
      .slice(0, limit);
    this.calls[this.calls.length - 1].rows = rows.length;
    return { ok: true, rows: clone(rows) };
  }

  async currentAccountId(): Promise<string | null> {
    return this.account;
  }

  onAuthChange(cb: AuthChangeListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
