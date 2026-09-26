/**
 * Re-restore idempotence when the device clock is behind the file's stamps
 * (refuter finding, Wave 2). Stored-pins cases live in w2-settings-stored-bad-pins.
 *
 * Hand-derived: A 100x5 then B 110x5 -> B prCount 2 (weight 110 > 100, e1rm 123.75 > 112.5).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { inspectBackupJson, restoreBackupJson } from '@/lib/import/service/backup';
import { T0, draft, exercise, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

async function finish(t: TestRepo, id: string, pid: string, kg: number) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, pid, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

async function twoLogBackup(): Promise<{ backup: BackupV3; pid: string }> {
  const src = freshRepo();
  const pid = (await src.repo.profiles.create({ name: 'P' })).id;
  await finish(src, 'A', pid, 100);
  await finish(src, 'B', pid, 110);
  return { backup: await src.repo.exportBackup(pid), pid };
}

describe('re-restoring an applied file while the clock is behind it', () => {
  it('a file whose B annotations are stale needs no confirmation the second time', async () => {
    const { backup } = await twoLogBackup();
    // Written by an older build: B carries no isPR / prCount 0 (stamps T0+2d, file stays as is).
    const stale = backup.workoutLogs.map((l) =>
      l.id === 'B' ? { ...l, prCount: 0, exercises: l.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, isPR: undefined })) })) } : l,
    );
    const text = JSON.stringify({ ...backup, workoutLogs: stale });
    const dst = freshRepo({ start: T0 }); // this device's clock: 2 days behind the file
    await restoreBackupJson(dst.repo, text);
    dst.tick();
    const again = await inspectBackupJson(dst.repo, text);
    // types.ts: "Re-restoring a file already applied is a no-op and needs no confirmation."
    expect(again.requiresConfirmation).toBe(false);
  });
});
