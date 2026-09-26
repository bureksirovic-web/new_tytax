import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { SetEntry, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { loadCatalog } from '@/lib/catalog';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { useAnalyticsData, useExerciseAnalyticsData, localDayDaysAgo } = await import('../use-analytics-data');

const SWING = 'kb_swing_two-hand-swing';
const DAY_MS = 86_400_000;

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-${n}`) });
  holder.repo = repo;
  return repo;
}

function set(id: string, kg: number, reps: number, type: SetEntry['type'] = 'working'): SetEntry {
  return { id, type, kg, reps, done: true };
}

async function logSwings(repo: Repository, profileId: string, id: string, daysAgo: number, sets: SetEntry[]) {
  const started = new Date(Date.now() - daysAgo * DAY_MS);
  const draft: WorkoutDraft = {
    id,
    profileId,
    sessionName: id,
    startedAt: started.toISOString(),
    exercises: [{ uid: `u-${id}`, exerciseId: SWING, exerciseName: 'Swing', modality: 'kettlebell', sets }],
  };
  await repo.finishWorkout(draft, { finishedAt: new Date(started.getTime() + 3_600_000).toISOString() });
}

describe('localDayDaysAgo', () => {
  it('counts local calendar days back from now', () => {
    // 2026-03-10 local noon − 7 days = 2026-03-03
    expect(localDayDaysAgo(7, new Date(2026, 2, 10, 12))).toBe('2026-03-03');
    // across a month boundary: 2026-03-02 − 3 days = 2026-02-27
    expect(localDayDaysAgo(3, new Date(2026, 2, 2, 12))).toBe('2026-02-27');
  });
});

describe('useAnalyticsData / useExerciseAnalyticsData', () => {
  it('reads the active profile logs from the repository and names exercises from the lazy catalog', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const other = await repo.profiles.create({ name: 'Other' });
    await logSwings(repo, me.id, 'a', 10, [set('a1', 20, 10), set('a0', 60, 1, 'warmup')]);
    await logSwings(repo, me.id, 'b', 3, [set('b1', 24, 8)]);
    await logSwings(repo, me.id, 'c', 100, [set('c1', 30, 5)]);
    await logSwings(repo, other.id, 'x', 2, [set('x1', 48, 5)]);
    const swingName = (await loadCatalog()).getById(SWING)?.name;
    expect(swingName).toBeTruthy();

    const { result } = renderHook(() => useAnalyticsData(90));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 'c' (100 days ago) is outside the 90-day window; 'x' belongs to another profile → a and b
    expect(result.current.logs.map((l) => l.id)).toEqual(['a', 'b']);
    // Brzycki: 20×36/(37−10) = 26.67 < 24×36/(37−8) = 29.79 → best is 24 kg × 8; the 60 kg warm-up never counts
    expect(result.current.bestLifts[SWING]).toMatchObject({ weight: 24, reps: 8 });
    expect(result.current.bestLifts[SWING].e1rm).toBeCloseTo((24 * 36) / 29, 6);
    expect(result.current.nameOf(SWING)).toBe(swingName);
    expect(result.current.nameOf('not-an-exercise')).toBe('not-an-exercise');

    const single = renderHook(() => useExerciseAnalyticsData(SWING));
    await waitFor(() => expect(single.result.current.isLoading).toBe(false));
    // whole history of this profile: c (100 d), a (10 d), b (3 d), oldest first
    expect(single.result.current.e1rmProgression.map((p) => p.weight)).toEqual([30, 20, 24]);
    await waitFor(() => expect(single.result.current.exerciseName).toBe(swingName));
  });
});
