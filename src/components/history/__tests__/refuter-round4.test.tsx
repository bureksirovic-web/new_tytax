import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { fromLog, toPatch } from '../edit-model';
import { MuscleImpact } from '../muscle-impact';
import { NOW, renderEn, resetDb } from './test-utils';

const catalogState = vi.hoisted(() => ({ value: null as null | { catalog: undefined; loading: boolean; error?: Error } }));

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/hooks/use-exercises', async (orig) => {
  const real = await orig<typeof import('@/hooks/use-exercises')>();
  return { ...real, useCatalog: (...a: Parameters<typeof real.useCatalog>) => catalogState.value ?? real.useCatalog(...a) };
});

beforeEach(async () => {
  await resetDb();
  catalogState.value = null;
});

const bench = (): WorkoutLog =>
  buildWorkoutLog('p1', { daysAgo: 0, exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }] }] }, NOW, sequentialIds('r'));

describe('history refuter round 4', () => {
  it('re-dating a workout shifts startedAt/finishedAt by the same number of days', () => {
    const log = bench();
    expect(log.date).toBe('2026-09-16');
    const draft = { ...fromLog(log, 'kg'), date: '2026-09-10' };
    const patch = toPatch(draft, 'kg');
    const start = new Date(patch.startedAt ?? log.startedAt);
    const end = new Date(patch.finishedAt ?? log.finishedAt);
    // Same local wall-clock time, 6 days earlier; duration unchanged.
    expect([start.getFullYear(), start.getMonth() + 1, start.getDate()]).toEqual([2026, 9, 10]);
    expect(start.getHours()).toBe(new Date(log.startedAt).getHours());
    expect(end.getTime() - start.getTime()).toBe(Date.parse(log.finishedAt) - Date.parse(log.startedAt));
    // Unchanged date → timestamps untouched.
    expect(toPatch(fromLog(log, 'kg'), 'kg').startedAt).toBeUndefined();
  });

  it('muscle impact falls back to snapshots when the catalog failed', () => {
    catalogState.value = { catalog: undefined, loading: false, error: new Error('offline') };
    const built = bench();
    const log: WorkoutLog = {
      ...built,
      exercises: [{ ...built.exercises[0], muscleImpactSnapshot: [{ muscle: 'Chest', score: 75 }, { muscle: 'Triceps', score: 25 }] }],
    };
    renderEn(<MuscleImpact log={log} />);
    const rows = within(screen.getByTestId('history-impact')).getAllByTestId('history-impact-row');
    expect(rows.map((r) => r.textContent)).toEqual(['Chest75%', 'Triceps25%']);
  });
});
