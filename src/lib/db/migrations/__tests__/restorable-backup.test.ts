/**
 * Regression: v2 wrote program and note stamps with `isoDate()`
 * ('YYYY-MM-DD'); migrated rows must still form a restorable BackupV3.
 */
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts';
import { parseBackupV3 } from '@/lib/import/backup-v3';
import { migrateArsenalV2, migrateBodyweightV2, migrateNoteV2, migratePRRecordV2 } from '../records';
import { migrateSnapshotV2toV3 } from '../snapshot';
import type { SnapshotV2 } from '../types';
import { CTX, v2Program, v2Snapshot, v2User } from './fixture';

function asBackup(snapshot: SnapshotV2): BackupV3 {
  const { tables } = migrateSnapshotV2toV3(snapshot, CTX);
  return { format: 'tytax-backup', version: 3, exportedAt: CTX.now, ...tables };
}

describe('migrated v2 snapshot is a restorable BackupV3', () => {
  it('the full fixture snapshot parses and survives the restore unchanged', () => {
    const backup = asBackup(v2Snapshot());
    const { backup: restored } = parseBackupV3(JSON.stringify(backup));
    expect(restored).toStrictEqual(JSON.parse(JSON.stringify(backup)));
  });

  it('date-only program stamps (installPreset/activate/delete/advance) become midnight UTC', () => {
    const { programs } = asBackup(v2Snapshot());
    const byId = new Map(programs.map((p) => [p.id, p]));
    expect(byId.get('p-1')).toMatchObject({ createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });
    expect(byId.get('p-2')?.updatedAt).toBe('2026-03-05T00:00:00.000Z');
    expect(byId.get('p-3')).toMatchObject({ updatedAt: '2026-03-09T00:00:00.000Z', deletedAt: '2026-03-09T00:00:00.000Z' });
    expect(byId.get('p-4')?.deletedAt).toBeUndefined();
  });

  it('program stamps: unreadable falls back (createdAt <- updatedAt <- now), a soft delete is never undone', () => {
    const { programs } = asBackup({
      profiles: [v2User()],
      programs: [
        v2Program('a', { createdAt: 'junk', updatedAt: '2026-02-02', rotationStartDate: '2026-02-02T07:00:00.000Z' }),
        v2Program('b', { createdAt: '', updatedAt: '', deletedAt: 'yes', rotationStartDate: 'monday' }),
      ],
    });
    expect(programs[0]).toMatchObject({ createdAt: '2026-02-02T00:00:00.000Z', rotationStartDate: '2026-02-02' });
    expect(programs[1]).toMatchObject({ createdAt: CTX.now, updatedAt: CTX.now, deletedAt: CTX.now });
    expect(programs[1]).not.toHaveProperty('rotationStartDate');
    expect(() => parseBackupV3(JSON.stringify(asBackup({ profiles: [v2User()], programs: [v2Program('b', { updatedAt: 'x', deletedAt: 'y' })] })))).not.toThrow();
  });

  it('the active program compares coerced updatedAt: a bare day equals its midnight stamp, id breaks the tie', () => {
    const { tables } = migrateSnapshotV2toV3(
      {
        profiles: [v2User({ activeFamilyMemberId: undefined })],
        programs: [
          v2Program('p-b', { isActive: true, updatedAt: '2026-03-05T00:00:00.000Z' }),
          v2Program('p-a', { isActive: true, updatedAt: '2026-03-05' }),
        ],
      },
      CTX,
    );
    expect(tables.profiles[0].activeProgramId).toBe('p-a');
  });
});

describe('record stamps written with isoDate()', () => {
  it('an exercise note gets ISO createdAt === updatedAt at midnight UTC', () => {
    const n = migrateNoteV2({ id: 'n', profileId: 'local', exerciseId: 'e', content: 'c', updatedAt: '2026-03-01' }, 'u', CTX.now);
    expect(n).toMatchObject({ createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });
    const junk = migrateNoteV2({ id: 'n', profileId: 'local', exerciseId: 'e', content: 'c', updatedAt: '' }, 'u', CTX.now);
    expect(junk.updatedAt).toBe(CTX.now);
  });

  it('PR achievedAt, bodyweight createdAt and arsenal addedAt are coerced the same way', () => {
    const pr = migratePRRecordV2(
      { id: 'p', profileId: 'local', exerciseId: 'e', exerciseName: 'E', prType: 'weight', value: 100, achievedAt: '2026-03-02', workoutLogId: 'l' },
      'u',
      CTX.now,
    );
    expect(pr).toMatchObject({ achievedAt: '2026-03-02T00:00:00.000Z', createdAt: '2026-03-02T00:00:00.000Z', updatedAt: '2026-03-02T00:00:00.000Z' });
    const bw = migrateBodyweightV2({ id: 'b', profileId: 'local', date: '2026-03-01', valueKg: 80, createdAt: '2026-03-01' }, 'u', CTX.now);
    expect(bw).toMatchObject({ createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });
    const a = migrateArsenalV2({ id: 'bench', profileId: 'local', addedAt: 'n/a' }, 'u', CTX.now);
    expect(a).toMatchObject({ addedAt: CTX.now, updatedAt: CTX.now });
  });

  it('a snapshot of date-only notes/PRs/bodyweight/arsenal rows parses as BackupV3', () => {
    const snap = v2Snapshot();
    snap.exerciseNotes = [{ id: 'n-1', profileId: 'local', exerciseId: 'bench', content: 'x', updatedAt: '2026-03-01' }];
    snap.bodyweightEntries = [{ id: 'bw-1', profileId: 'local', date: '2026-03-01', valueKg: 80, createdAt: '2026-03-01' }];
    snap.arsenal = [{ id: 'bench', profileId: 'local', addedAt: '2026-02-01' }];
    expect(() => parseBackupV3(JSON.stringify(asBackup(snap)))).not.toThrow();
  });

  it('a family member row without createdAt (refuter R1, 2026-09-27) migrates to a restorable profile stamped now', () => {
    const snapshot = { ...v2Snapshot(), familyMembers: [{ id: 'fm-no', profileId: 'u-1', name: 'NoDate' }] } as unknown as SnapshotV2;
    const backup = asBackup(snapshot);
    const fm = backup.profiles.find((p) => p.id === 'fm-no');
    expect(fm).toMatchObject({ name: 'NoDate', createdAt: CTX.now, updatedAt: CTX.now });
    const { backup: restored } = parseBackupV3(JSON.stringify(backup));
    expect(restored.profiles.find((p) => p.id === 'fm-no')?.createdAt).toBe(CTX.now);
  });
});
