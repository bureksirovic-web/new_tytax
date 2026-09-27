/**
 * Review S3-12: every public read (and outbox / exportBackup) maps a storage
 * failure to RepoError('STORAGE'), never a raw DexieError.
 */
import 'fake-indexeddb/auto';
import { describe, it } from 'vitest';
import type { Repository } from '@/contracts/repo';
import { expectCode, freshRepo } from './helpers';

type Call = [string, (r: Repository) => Promise<unknown>];

const P = 'p1';
const READS: Call[] = [
  ['profiles.list', (r) => r.profiles.list()],
  ['profiles.get', (r) => r.profiles.get(P)],
  ['profiles.getActiveId', (r) => r.profiles.getActiveId()],
  ['logs.list', (r) => r.logs.list(P)],
  ['logs.get', (r) => r.logs.get(P, 'x')],
  ['logs.historyFor', (r) => r.logs.historyFor(P, 'bench')],
  ['logs.count', (r) => r.logs.count(P)],
  ['programs.list', (r) => r.programs.list(P)],
  ['programs.get', (r) => r.programs.get(P, 'x')],
  ['programs.getActive', (r) => r.programs.getActive(P)],
  ['prs.list', (r) => r.prs.list(P)],
  ['prs.best', (r) => r.prs.best(P, 'bench')],
  ['bodyweight.list', (r) => r.bodyweight.list(P)],
  ['notes.get', (r) => r.notes.get(P, 'bench')],
  ['notes.list', (r) => r.notes.list(P)],
  ['arsenal.list', (r) => r.arsenal.list(P)],
  ['arsenal.has', (r) => r.arsenal.has(P, 'bench')],
  ['equipment.get', (r) => r.equipment.get(P)],
  ['outbox.peek', (r) => r.outbox.peek(10)],
  ['outbox.count', (r) => r.outbox.count()],
  ['outbox.ack', (r) => r.outbox.ack(['x'])],
  ['outbox.fail', (r) => r.outbox.fail('x', 'e')],
  ['exportBackup()', (r) => r.exportBackup()],
  ['exportBackup(p)', (r) => r.exportBackup(P)],
];

describe('S3-12 storage failures on reads map to RepoError(STORAGE)', () => {
  it.each(READS)('%s on a closed database', async (_name, call) => {
    const { db, repo } = freshRepo();
    await repo.profiles.list(); // open, then close for good
    db.close({ disableAutoOpen: true });
    await expectCode(call(repo), 'STORAGE');
  });

  it.each(READS)('%s when a newer tab upgraded the database (VersionError)', async (_name, call) => {
    const { db, repo } = freshRepo();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(db.name, 9999);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error ?? new Error('open failed'));
    });
    await expectCode(call(repo), 'STORAGE');
  });
});
