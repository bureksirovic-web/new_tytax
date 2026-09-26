/**
 * Live harness for `*.sync.test.ts` (npm run test:sync): real supabase-js
 * clients against the local Supabase stack, real Dexie repositories on
 * fake-indexeddb (import 'fake-indexeddb/auto' first in the test file).
 * Every id is a random v4 uuid, so repeated runs never collide on the server.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProgramTemplate, WorkoutDraft } from '@/contracts/domain';
import type { BackupV3, Repository } from '@/contracts/repo';
import { TytaxDatabase, createRepository } from '@/lib/db';
import { createSupabaseSyncAdapter, type SupabaseSyncAdapter } from '../adapter';
import { silentSyncLogger } from '../log';
import { createSupabaseRemoteStore, type RemoteStore } from '../remote';
import type { RemoteRow } from '../mapper';
import { MemoryStorage, manualTimers } from './harness';

export interface LiveEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

const HOW_TO =
  'npm run test:sync needs a running local Supabase and its env. Run in the repo root:\n' +
  '  npx -y supabase@2.118.0 start\n' +
  '  eval "$(npx -y supabase@2.118.0 status -o env | sed \'s/^/export /\')"\n' +
  '  export NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY\n' +
  '  npm run test:sync\n' +
  '(scripts/ci-local.sh --only sync-e2e does all of this.)';

/** Reads the env or throws with instructions. Never skips (AC12: zero skips). */
export function requireLiveEnv(): LiveEnv {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const missing = [
    !url && 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Missing env: ${missing.join(', ')}.\n${HOW_TO}`);
  return { url, anonKey, serviceKey };
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

export function adminClient(env: LiveEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, noSession);
}

export interface LiveUser {
  id: string;
  email: string;
  password: string;
}

const RUN = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

/** A confirmed user with a unique email per run. */
export async function createLiveUser(admin: SupabaseClient, label: string): Promise<LiveUser> {
  userCounter += 1;
  const email = `sync-${label}-${RUN}-${userCounter}@tytax.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`admin.createUser failed: ${error?.status ?? '?'} ${error?.code ?? ''}`);
  return { id: data.user.id, email, password };
}

/** A fresh supabase-js client (in-memory session) signed in as `user`. */
export async function signedInClient(env: LiveEnv, user: LiveUser): Promise<SupabaseClient> {
  const client = createClient(env.url, env.anonKey, noSession);
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error || data.user?.id !== user.id) throw new Error(`signInWithPassword failed: ${error?.status ?? '?'} ${error?.code ?? ''}`);
  return client;
}

/** A RemoteStore that records every upserted row (for the no-`local`-ids check). */
export function recordingRemote(inner: RemoteStore): RemoteStore & { upserts: Array<{ table: string; row: RemoteRow }> } {
  const upserts: Array<{ table: string; row: RemoteRow }> = [];
  return {
    upserts,
    async upsert(table, rows) {
      for (const row of rows) upserts.push({ table, row });
      return inner.upsert(table, rows);
    },
    pull: (t, s, a, l) => inner.pull(t, s, a, l),
    undelete: (t, id) => inner.undelete(t, id),
    currentAccountId: () => inner.currentAccountId(),
    onAuthChange: (cb) => inner.onAuthChange(cb),
  };
}

export interface LiveDevice {
  name: string;
  client: SupabaseClient;
  remote: ReturnType<typeof recordingRemote>;
  repo: Repository;
  adapter: SupabaseSyncAdapter;
  storage: MemoryStorage;
  db: TytaxDatabase;
  /** Make the next `applyRemote` call throw (the retry-cursor test). */
  failNextApply: () => void;
  applyCalls: () => number;
}

let dbCounter = 0;

export interface LiveDeviceOptions {
  /** Device clock for both the repository and the adapter (clock-skew tests). */
  now?: () => Date;
  /** Reopen another device's IndexedDB (a reload that lost localStorage). */
  db?: TytaxDatabase;
}

/**
 * One device: its own Dexie DB name, cursor storage and signed-in client.
 * Timers are manual and never fired, so the debounce/retry timers never start
 * a background run; every run in a test is an explicit `syncNow()`.
 */
export function liveDevice(name: string, client: SupabaseClient, storage = new MemoryStorage(), opts: LiveDeviceOptions = {}): LiveDevice {
  dbCounter += 1;
  const db = opts.db ?? new TytaxDatabase(`live-${name}-${dbCounter}-${crypto.randomUUID()}`);
  const remote = recordingRemote(createSupabaseRemoteStore(client));
  const timers = manualTimers();
  let failNext = false;
  let applies = 0;
  const ref: { repo?: Repository } = {};
  const adapter = createSupabaseSyncAdapter({
    repo: () => ref.repo as Repository,
    remote,
    storage,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    isOnline: () => true,
    log: silentSyncLogger,
    ...(opts.now ? { now: opts.now } : {}),
  });
  const base = createRepository({ db, sync: adapter, ...(opts.now ? { now: opts.now } : {}) });
  // The adapter sees a repository whose applyRemote can be made to fail once.
  ref.repo = {
    ...base,
    async applyRemote(table, records) {
      applies += 1;
      if (failNext) {
        failNext = false;
        throw new Error('injected applyRemote failure');
      }
      return base.applyRemote(table, records);
    },
  };
  return {
    name,
    client,
    remote,
    repo: base,
    adapter,
    storage,
    db,
    failNextApply: () => {
      failNext = true;
    },
    applyCalls: () => applies,
  };
}

export function programTemplate(name: string): ProgramTemplate {
  const days = ['Push', 'Pull', 'Legs'];
  return {
    name,
    splitType: 'push_pull_legs',
    frequency: 3,
    periodizationType: 'none',
    sessionOrder: days,
    sessions: days.map((d, i) => ({
      id: crypto.randomUUID(),
      programId: 'template',
      name: d,
      dayIndex: i,
      exercises: [{ exerciseId: 'tytax-bench-press', exerciseName: 'Bench press', modality: 'tytax' as const, sets: 3, reps: '8-12' }],
    })),
    modalitiesUsed: ['tytax'],
    isPreset: false,
    currentSessionIndex: 0,
  };
}

export function workoutDraft(profileId: string, programId: string | undefined, sessionId: string | undefined): WorkoutDraft {
  const startedAt = new Date(Date.now() - 45 * 60_000).toISOString();
  return {
    id: crypto.randomUUID(),
    profileId,
    programId,
    programSessionId: sessionId,
    sessionName: 'Push',
    startedAt,
    exercises: [
      {
        uid: crypto.randomUUID(),
        exerciseId: 'tytax-bench-press',
        exerciseName: 'Bench press',
        modality: 'tytax',
        sets: [
          { id: crypto.randomUUID(), type: 'warmup', kg: 40, reps: 10, done: true, completedAt: startedAt },
          { id: crypto.randomUUID(), type: 'working', kg: 80, reps: 8, rir: 2, done: true, completedAt: startedAt },
          { id: crypto.randomUUID(), type: 'working', kg: 85, reps: 6, rir: 1, done: true, completedAt: startedAt },
        ],
      },
    ],
  };
}

type Rec = Record<string, unknown>;

/** A backup with volatile keys dropped and every table sorted by id, for equality checks. */
export function comparable(backup: BackupV3, drop: readonly string[] = ['syncedAt', 'updatedAt']): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {};
  for (const [key, value] of Object.entries(backup)) {
    if (!Array.isArray(value)) continue;
    out[key] = (value as Rec[])
      .map((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !drop.includes(k) && v !== undefined)))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return out;
}

export const WIRE_TABLES = [
  'family_members',
  'programs',
  'workout_logs',
  'pr_records',
  'bodyweight_entries',
  'exercise_notes',
  'arsenal',
  'equipment',
] as const;

/** Row count of one table as seen by `client` (RLS applies). */
export async function countRows(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new Error(`count ${table} failed: ${error.code}`);
  return count ?? 0;
}
