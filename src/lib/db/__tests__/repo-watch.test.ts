import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { exercise, draft, fakeSync, freshRepo } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('watch and resetAll', () => {
  it('watch re-runs the query on change and stops after unsubscribe', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const seen: number[] = [];
    const unsubscribe = repo.watch(() => repo.logs.count(p.id), (n) => seen.push(n));
    await vi.waitFor(() => expect(seen).toEqual([0]));
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await vi.waitFor(() => expect(seen).toEqual([0, 1]));
    unsubscribe();
    await repo.finishWorkout(draft('w2', p.id, [exercise('u2', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.logs.count(p.id)).toBe(2);
    expect(seen).toEqual([0, 1]);
  });

  it('watch tracks reads made after several awaits (meta → profile)', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.ensureActive('Me');
    const names: Array<string | null> = [];
    const unsubscribe = repo.watch(
      async () => {
        const id = await repo.profiles.getActiveId();
        const profile = id ? await repo.profiles.get(id) : undefined;
        const logs = profile ? await repo.logs.count(profile.id) : 0;
        return profile ? `${profile.name}:${logs}` : null;
      },
      (v) => names.push(v),
    );
    await vi.waitFor(() => expect(names).toEqual(['Me:0']));
    await repo.profiles.update(p.id, { name: 'Ana' });
    await vi.waitFor(() => expect(names).toEqual(['Me:0', 'Ana:0']));
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    await vi.waitFor(() => expect(names).toEqual(['Me:0', 'Ana:0', 'Ana:1']));
    unsubscribe();
  });

  it('resetAll wipes every table', async () => {
    const { repo, db } = freshRepo({ sync: fakeSync() });
    const p = await repo.profiles.ensureActive('Me');
    await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await repo.resetAll();
    const counts = await Promise.all(db.tables.map((t) => t.count()));
    expect(counts.every((c) => c === 0)).toBe(true);
    expect(await repo.profiles.getActiveId()).toBeNull();
  });
});

describe('watch across tables', () => {
  it('fires again when a different repo call writes another table the query read', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const seen: string[] = [];
    const summary = async () => {
      const [bw, notes, arsenal] = await Promise.all([repo.bodyweight.list(p.id), repo.notes.list(p.id), repo.arsenal.list(p.id)]);
      return `${bw.length}/${notes.length}/${arsenal.length}`;
    };
    const unsubscribe = repo.watch(summary, (v) => seen.push(v));
    await vi.waitFor(() => expect(seen).toEqual(['0/0/0']));
    await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await vi.waitFor(() => expect(seen.at(-1)).toBe('1/0/0'));
    await repo.notes.set(p.id, 'bench', 'x');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('1/1/0'));
    await repo.arsenal.add(p.id, 'bench');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('1/1/1'));
    unsubscribe();
    const count = seen.length;
    await repo.arsenal.add(p.id, 'squat');
    await repo.bodyweight.add(p.id, { date: '2026-03-02', valueKg: 71 });
    expect(await summary()).toBe('2/1/2');
    expect(seen).toHaveLength(count);
  });

  it('reports query failures to onError, and a missing onError does not throw', async () => {
    const { repo } = freshRepo();
    const errors: unknown[] = [];
    const values: unknown[] = [];
    const failing = async (): Promise<number> => {
      throw new Error('query failed');
    };
    const stop1 = repo.watch(failing, (v) => values.push(v), (e) => errors.push(e));
    const stop2 = repo.watch(failing, (v) => values.push(v));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect((errors[0] as Error).message).toBe('query failed');
    expect(values).toEqual([]);
    stop1();
    stop2();
  });
});
