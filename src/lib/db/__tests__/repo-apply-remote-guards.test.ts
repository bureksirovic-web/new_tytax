/** applyRemote guards (src/lib/db/repo/apply-remote.ts): ownership, shape, tombstone ties. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, freshRepo } from './helpers';

const LATER = '2030-01-01T00:00:00.000Z';

describe('applyRemote ownership and shape', () => {
  it('never moves an existing row to another profile', async () => {
    const { repo, db } = freshRepo({ sync: fakeSync(true) });
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const bw = await repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });

    expect(await repo.applyRemote('bodyweight_entries', [{ ...bw, profileId: b.id, valueKg: 1, updatedAt: LATER }])).toEqual({ applied: 0, skipped: 1 });
    expect(await db.bodyweightEntries.get(bw.id)).toEqual(bw);
    expect(await repo.bodyweight.list(b.id)).toEqual([]);
  });

  it('skips malformed rows so later reads keep working', async () => {
    const { repo, db } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const noExercises = { id: 'x', profileId: a.id, date: '2026-03-01', updatedAt: LATER };
    const noDate = { id: 'y', profileId: a.id, exercises: [], updatedAt: LATER };
    const noOwner = { id: 'z', date: '2026-03-01', exercises: [], updatedAt: LATER };

    expect(await repo.applyRemote('workout_logs', [noExercises, noDate, noOwner])).toEqual({ applied: 0, skipped: 3 });
    expect(await repo.applyRemote('programs', [{ id: 'p', profileId: a.id, name: 'P', updatedAt: LATER }])).toEqual({ applied: 0, skipped: 1 });
    expect(await repo.applyRemote('bodyweight_entries', [{ id: 'b', profileId: '', valueKg: 1, updatedAt: LATER }])).toEqual({ applied: 0, skipped: 1 });
    expect(await db.workoutLogs.count()).toBe(0);
    expect(await db.programs.count()).toBe(0);
    await expect(repo.logs.historyFor(a.id, 'bench')).resolves.toEqual([]);
  });

  it('accepts a well-formed pulled workout log', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const ok = {
      id: 'w', profileId: a.id, sessionName: 'Upper A', date: '2026-03-01',
      startedAt: '2026-03-01T10:00:00.000Z', finishedAt: '2026-03-01T11:00:00.000Z', durationSeconds: 3600,
      exercises: [], totalVolumeKg: 0, totalSets: 0, prCount: 0, modalitiesUsed: [],
      createdAt: '2026-03-01T11:00:00.000Z', updatedAt: LATER,
    };
    expect(await repo.applyRemote('workout_logs', [ok])).toEqual({ applied: 1, skipped: 0 });
    expect((await repo.logs.get(a.id, 'w'))?.date).toBe('2026-03-01');
  });
});

describe('applyRemote equal-timestamp tie-break', () => {
  it('a remote tombstone with the same updatedAt as the live local row wins', async () => {
    const { repo } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const bw = await repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });

    expect(await repo.applyRemote('bodyweight_entries', [{ ...bw, deletedAt: bw.updatedAt }])).toEqual({ applied: 1, skipped: 0 });
    expect(await repo.bodyweight.list(a.id)).toEqual([]);
    expect((await repo.bodyweight.list(a.id, { includeDeleted: true }))[0].deletedAt).toBe(bw.updatedAt);
  });

  it('a live remote row with the same updatedAt never resurrects a local tombstone', async () => {
    const { repo, db } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const bw = await repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });
    await db.bodyweightEntries.put({ ...bw, deletedAt: bw.updatedAt });

    expect(await repo.applyRemote('bodyweight_entries', [{ ...bw }])).toEqual({ applied: 0, skipped: 1 });
    expect(await repo.bodyweight.list(a.id)).toEqual([]);
  });
});
