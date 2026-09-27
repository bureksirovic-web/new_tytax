/**
 * Review R02: `outbox.peek` must return ops in insertion order even when they
 * share a `createdAt` millisecond. Uses the production id generator (random
 * uuid) and a frozen clock, so every op ties on `createdAt`.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { SyncOperation } from '@/contracts/sync';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';
import { draft, exercise, fakeSync, seedProfile, T0 } from './helpers';

let n = 0;
function frozenRepo() {
  n += 1;
  const db = new TytaxDatabase(`r02-${n}-${Math.random().toString(36).slice(2)}`);
  const inserted: string[] = [];
  db.syncQueue.hook('creating', (_pk, op: SyncOperation) => {
    inserted.push(`${op.table}:${op.recordId}`);
  });
  const repo = createRepository({ db, sync: fakeSync(), now: () => new Date(T0) });
  return { db, repo, inserted };
}

const key = (op: SyncOperation) => `${op.table}:${op.recordId}`;

describe('R02 outbox insertion order (random ids, frozen clock)', () => {
  it('finishWorkout: the workout_logs op always precedes its pr_records ops', async () => {
    const { repo, inserted } = frozenRepo();
    const p = await repo.profiles.create({ name: 'A' });
    for (let i = 0; i < 25; i++) {
      await repo.outbox.ack((await repo.outbox.peek(1000)).map((o) => o.id));
      inserted.length = 0;
      const kg = 50 + i * 5; // heavier each round → new PR rows every time
      await repo.finishWorkout(draft(`w-${i}`, p.id, [exercise(`u-${i}`, 'bench', [{ kg, reps: 5 }])]));
      const ops = await repo.outbox.peek(1000);
      expect(ops.some((o) => o.table === 'pr_records')).toBe(true);
      expect(ops.map(key)).toEqual(inserted);
      expect((await repo.outbox.peek(1))[0].table).toBe('workout_logs');
    }
  });

  it('queue across writes and queueMany (bulkAdd) keep insertion order', async () => {
    const src = frozenRepo();
    await src.repo.transaction(async () => {
      for (const name of ['A', 'B', 'C']) await seedProfile(src.repo, name);
    });
    const backup = await src.repo.exportBackup();
    for (let i = 0; i < 5; i++) {
      const dst = frozenRepo();
      const before = await dst.repo.profiles.create({ name: 'pre' });
      await dst.repo.bodyweight.add(before.id, { date: '2026-03-01', valueKg: 80 });
      await dst.repo.importBackup(backup);
      const ops = await dst.repo.outbox.peek(10_000);
      expect(ops.length).toBeGreaterThan(20);
      expect(ops.map(key)).toEqual(dst.inserted);
    }
  });
});
