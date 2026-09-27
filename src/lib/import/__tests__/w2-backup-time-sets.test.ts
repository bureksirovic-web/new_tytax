/**
 * BackupV3 round-trip of a time-measured set (SetEntry.durationSeconds,
 * src/contracts/domain.ts): the schema keeps durationSeconds and
 * ghostDurationSeconds, the totals repair uses the repo's computeTotals (a time
 * set counts in totalSets, adds no kg volume), and the restore's PR rebuild
 * never ranks a hold.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { SessionExercise } from '@/contracts/domain';
import { draft, exercise, freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, restoreBackupJson } from '..';

const NOW = new Date(T0.getTime() + 86_400_000);

/** Static hold that still carries kg and reps (e.g. a weighted carry). */
const hold = (uid: string): SessionExercise => ({
  uid,
  exerciseId: 'plank',
  exerciseName: 'Plank',
  modality: 'tytax',
  sets: [{ id: `${uid}-s0`, type: 'working', kg: 32, reps: 10, done: true, durationSeconds: 45, ghostDurationSeconds: 40 }],
});

async function seed() {
  const src = freshRepo();
  const pid = (await src.repo.profiles.create({ name: 'Ana' })).id;
  await src.repo.finishWorkout(
    draft('w1', pid, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }]), hold('u2')], { startedAt: T0.toISOString() }),
    { finishedAt: new Date(T0.getTime() + 3_600_000).toISOString() },
  );
  return { src, pid, dst: freshRepo(), json: await exportBackupJson(src.repo, pid) };
}

describe('restore of a backup containing a time-measured set', () => {
  it('the exported file keeps durationSeconds (the bug is not in the export)', async () => {
    const { json } = await seed();
    expect(JSON.parse(json).workoutLogs[0].exercises[1].sets[0].durationSeconds).toBe(45);
  });

  it('the source log stores 500 kg (the hold adds no volume)', async () => {
    const { src, pid } = await seed();
    const before = await src.repo.logs.get(pid, 'w1');
    expect(before?.totalVolumeKg).toBe(500);
    expect(before?.totalSets).toBe(2);
    expect(await src.repo.prs.list(pid, { exerciseId: 'plank' })).toEqual([]);
  });

  it('restore keeps durationSeconds and ghostDurationSeconds', async () => {
    const { pid, dst, json } = await seed();
    await restoreBackupJson(dst.repo, json, { now: NOW });
    const after = await dst.repo.logs.get(pid, 'w1');
    expect(after?.exercises[1].sets[0].durationSeconds).toBe(45);
    expect(after?.exercises[1].sets[0].ghostDurationSeconds).toBe(40);
  });

  it('restore keeps the volume the repo computed: 500 kg, no repair warning', async () => {
    const { pid, dst, json } = await seed();
    const res = await restoreBackupJson(dst.repo, json, { now: NOW });
    const after = await dst.repo.logs.get(pid, 'w1');
    expect(after?.totalVolumeKg).toBe(500);
    expect(res.warnings).toEqual([]);
  });

  it('restore does not turn the hold into PR records', async () => {
    const { pid, dst, json } = await seed();
    await restoreBackupJson(dst.repo, json, { now: NOW });
    expect(await dst.repo.prs.list(pid, { exerciseId: 'plank' })).toEqual([]);
    expect((await dst.repo.logs.get(pid, 'w1'))?.exercises[1].sets[0].e1rm).toBeUndefined();
  });
});
