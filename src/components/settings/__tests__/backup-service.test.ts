import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { RepoError } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { backupErrorKey, BackupFileError, fromG2Service, localBackupService } from '../backup-service';

describe('fromG2Service', () => {
  it('is null unless all three G2 functions are exported', () => {
    expect(fromG2Service({})).toBeNull();
    expect(fromG2Service({ exportBackupJson: vi.fn(), inspectBackupJson: vi.fn(), restoreBackupJson: 'x' })).toBeNull();
  });

  it('delegates to G2 with a pretty export', async () => {
    const mod = {
      exportBackupJson: vi.fn(() => Promise.resolve('{}')),
      inspectBackupJson: vi.fn(() => Promise.resolve({ profiles: [], rows: 0, warnings: [] })),
      restoreBackupJson: vi.fn(() => Promise.resolve({ inserted: 2, updated: 1, skipped: 0, warnings: [], existingProfileIds: [] })),
    };
    const service = fromG2Service(mod);
    const repo = {} as never;
    expect(await service?.exportJson(repo, 'p1')).toBe('{}');
    expect(mod.exportBackupJson).toHaveBeenCalledWith(repo, 'p1', { pretty: true });
    expect(await service?.inspect(repo, 'text')).toEqual({ profiles: [], rows: 0, warnings: [] });
    expect(await service?.restore(repo, 'text')).toMatchObject({ inserted: 2, updated: 1 });
    expect(mod.restoreBackupJson).toHaveBeenCalledWith(repo, 'text');
  });
});

describe('localBackupService', () => {
  it('exports JSON that its own inspection accepts, flagging the profile as existing', async () => {
    const repo = createRepository({ db: new TytaxDatabase('backup-service-1') });
    const me = await repo.profiles.ensureActive('Ana');
    const text = await localBackupService.exportJson(repo, me.id);
    expect(JSON.parse(text)).toMatchObject({ format: 'tytax-backup', version: 3 });
    expect((await localBackupService.inspect(repo, text)).profiles).toEqual([{ id: me.id, name: 'Ana', existsLocally: true }]);
    const fresh = createRepository({ db: new TytaxDatabase('backup-service-2') });
    expect((await localBackupService.inspect(fresh, text)).profiles).toEqual([{ id: me.id, name: 'Ana', existsLocally: false }]);
  });

  it('throws a coded error for a bad file and writes nothing', async () => {
    const repo = createRepository({ db: new TytaxDatabase('backup-service-3') });
    await expect(localBackupService.restore(repo, '{nope')).rejects.toMatchObject({ code: 'INVALID_JSON' });
    await expect(localBackupService.inspect(repo, '{"format":"x"}')).rejects.toBeInstanceOf(BackupFileError);
    expect(await repo.profiles.list({ includeDeleted: true })).toEqual([]);
  });
});

describe('backupErrorKey', () => {
  it('maps every G2 and repository code, and nothing else', () => {
    expect(backupErrorKey(new BackupFileError('UNSAFE_KEYS'))).toBe('set_import_error_unsafe');
    expect(backupErrorKey({ code: 'UNRECOGNIZED_FORMAT' })).toBe('set_import_error_unrecognized');
    expect(backupErrorKey(new RepoError('CONFLICT', 'raw'))).toBe('set_restore_error_conflict');
    expect(backupErrorKey(new RepoError('VALIDATION', 'raw'))).toBe('set_restore_error_validation');
    expect(backupErrorKey(new RepoError('NOT_FOUND', 'raw'))).toBe('set_restore_error_not_found');
    expect(backupErrorKey({ code: 'toString' })).toBe('set_action_failed');
    expect(backupErrorKey(new Error('raw'))).toBe('set_action_failed');
    expect(backupErrorKey(null)).toBe('set_action_failed');
  });
});
