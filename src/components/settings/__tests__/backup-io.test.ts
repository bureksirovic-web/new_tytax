import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { backupFilename, MAX_BACKUP_BYTES, parseBackupText } from '../backup-io';
import { emptyBackup, oneSetLog, seedLogs } from './settings-harness';

describe('parseBackupText', () => {
  it('accepts a real repository export and counts live rows', async () => {
    const repo = createRepository({ db: new TytaxDatabase('backup-io-1') });
    const me = await repo.profiles.ensureActive('Ana');
    await seedLogs(repo, me.id, [oneSetLog(1), oneSetLog(2), { ...oneSetLog(3), deleted: true }]);
    await repo.bodyweight.add(me.id, { date: '2026-09-20', valueKg: 80 });

    const parsed = parseBackupText(JSON.stringify(await repo.exportBackup(me.id)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // 3 logs seeded, 1 soft-deleted → 2 live
    expect(parsed.counts).toEqual({ profiles: 1, logs: 2, programs: 0, bodyweight: 1 });
    expect(parsed.profileNames).toEqual(['Ana']);
  });

  it('names each failure', () => {
    expect(parseBackupText('{nope')).toEqual({ ok: false, problem: 'invalid_json' });
    expect(parseBackupText(JSON.stringify({ format: 'other', version: 3 }))).toEqual({ ok: false, problem: 'unrecognized' });
    expect(parseBackupText(JSON.stringify({ ...emptyBackup(), version: 2 }))).toEqual({ ok: false, problem: 'unrecognized' });
    expect(parseBackupText(JSON.stringify({ ...emptyBackup(), programs: 'x' }))).toEqual({ ok: false, problem: 'structure' });
    // a log row without profileId
    expect(parseBackupText(JSON.stringify({ ...emptyBackup(), workoutLogs: [{ id: 'l1' }] }))).toEqual({
      ok: false,
      problem: 'structure',
    });
    expect(parseBackupText(' '.repeat(MAX_BACKUP_BYTES + 1))).toEqual({ ok: false, problem: 'too_large' });
  });

  it('refuses prototype-polluting keys', () => {
    const text = `{"format":"tytax-backup","version":3,"__proto__":{"polluted":true}}`;
    expect(parseBackupText(text)).toEqual({ ok: false, problem: 'unsafe' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('backupFilename', () => {
  it('slugs the profile name and dates the file', () => {
    expect(backupFilename('profile', 'Ana Marija', '2026-09-26')).toBe('tytax_backup_ana_marija_2026-09-26.json');
    // "Čačić": NFD splits off the carons, which are stripped → "cacic"
    expect(backupFilename('profile', 'Čačić', '2026-09-26')).toBe('tytax_backup_cacic_2026-09-26.json');
    expect(backupFilename('all', 'Ana', '2026-09-26')).toBe('tytax_backup_all_2026-09-26.json');
    expect(backupFilename('profile', '!!!', '2026-09-26')).toBe('tytax_backup_profile_2026-09-26.json');
  });
});
