/**
 * Test devices: a real Dexie repository (fake-indexeddb; import
 * 'fake-indexeddb/auto' in the test file first) wired to the adapter under
 * test, a manual timer queue and an in-memory storage.
 */
import type { ProgramTemplate, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { TytaxDatabase, createRepository } from '@/lib/db';
import { createSupabaseSyncAdapter, type SupabaseSyncAdapter, type SupabaseSyncAdapterOptions } from '../adapter';
import type { SyncStorage } from '../cursors';
import type { SyncLogEvent } from '../log';
import type { RemoteStore } from '../remote';

export const ACCOUNT_A = '0a0a0a0a-0000-4000-8000-00000000000a';
export const ACCOUNT_B = '0b0b0b0b-0000-4000-8000-00000000000b';
export const T0 = new Date(Date.UTC(2026, 2, 2, 12));

let dbCounter = 0;
let uuidCounter = 0;

/** Deterministic, valid v4 uuids. */
export function uuid(): string {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${uuidCounter.toString(16).padStart(12, '0')}`;
}

export class MemoryStorage implements SyncStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

export interface ManualTimers {
  pending: Array<{ id: number; ms: number; fn: () => void }>;
  delays: number[];
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  /** Runs every pending timer whose delay equals `ms` (or all when omitted). */
  fire(ms?: number): void;
}

export function manualTimers(): ManualTimers {
  let next = 0;
  const t: ManualTimers = {
    pending: [],
    delays: [],
    setTimeout(fn, ms) {
      next += 1;
      t.pending.push({ id: next, ms, fn });
      t.delays.push(ms);
      return next as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(id) {
      t.pending = t.pending.filter((p) => p.id !== (id as unknown as number));
    },
    fire(ms) {
      const due = t.pending.filter((p) => ms === undefined || p.ms === ms);
      t.pending = t.pending.filter((p) => !due.includes(p));
      due.forEach((p) => p.fn());
    },
  };
  return t;
}

export interface Device {
  repo: Repository;
  adapter: SupabaseSyncAdapter;
  db: TytaxDatabase;
  storage: MemoryStorage;
  timers: ManualTimers;
  logs: SyncLogEvent[];
  /** Moves the device clock forward. */
  tick(ms?: number): void;
  now(): Date;
  online: boolean;
}

/**
 * `start` sets the device clock (the repository's and the adapter's `now`),
 * so `start: T0 + 1 h` is a device whose clock runs an hour ahead of the
 * fake server. `db` reopens another device's IndexedDB (a reload that lost
 * localStorage but kept the data).
 */
export function makeDevice(
  remote: RemoteStore,
  opts: Partial<SupabaseSyncAdapterOptions> & { start?: Date; db?: TytaxDatabase } = {},
): Device {
  dbCounter += 1;
  const db = opts.db ?? new TytaxDatabase(`sync-${dbCounter}-${Math.random().toString(36).slice(2)}`);
  let clock = (opts.start ?? T0).getTime();
  const now = (): Date => new Date(clock);
  const storage = new MemoryStorage();
  const timers = manualTimers();
  const logs: SyncLogEvent[] = [];
  const device = { online: true } as Device;
  const ref: { repo?: Repository } = {};
  const adapter = createSupabaseSyncAdapter({
    repo: () => ref.repo as Repository,
    remote,
    storage,
    now,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    isOnline: () => device.online,
    random: () => 0,
    log: (e) => logs.push(e),
    ...adapterOpts(opts),
  });
  ref.repo = createRepository({ db, sync: adapter, now, newId: uuid });
  return Object.assign(device, {
    repo: ref.repo,
    adapter,
    db,
    storage,
    timers,
    logs,
    now,
    tick(ms = 1000) {
      clock += ms;
    },
  });
}

function adapterOpts(opts: Partial<SupabaseSyncAdapterOptions> & { start?: Date; db?: TytaxDatabase }): Partial<SupabaseSyncAdapterOptions> {
  const rest = { ...opts };
  delete rest.start;
  delete rest.db;
  return rest;
}

export function template(sessionCount: number): ProgramTemplate {
  return {
    name: `${sessionCount}-day split`,
    splitType: 'custom',
    frequency: sessionCount,
    periodizationType: 'none',
    sessionOrder: Array.from({ length: sessionCount }, (_, i) => `Day ${i + 1}`),
    sessions: Array.from({ length: sessionCount }, (_, i) => ({
      id: `tpl-${i}`,
      programId: 'tpl',
      name: `Day ${i + 1}`,
      dayIndex: i,
      exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax' as const, sets: 3, reps: '8-12' }],
    })),
    modalitiesUsed: ['tytax'],
    isPreset: true,
    presetId: 'preset-test',
    currentSessionIndex: 0,
  };
}

export function draftFor(profileId: string, startedAt: Date, sets: Array<[kg: number, reps: number]>, extra: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    id: uuid(),
    profileId,
    sessionName: 'Push day',
    startedAt: startedAt.toISOString(),
    exercises: [
      {
        uid: uuid(),
        exerciseId: 'bench',
        exerciseName: 'Bench',
        modality: 'tytax',
        sets: sets.map(([kg, reps]) => ({ id: uuid(), type: 'working' as const, kg, reps, done: true, completedAt: startedAt.toISOString() })),
      },
    ],
    ...extra,
  };
}
