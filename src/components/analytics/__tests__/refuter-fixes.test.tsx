import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';
import type { Exercise, MuscleGroup } from '@/contracts/domain';
import { movementParity, patternOf } from '../exercise-series';
import { LineChart } from '../line-chart';
import { MuscleDistribution } from '../muscle-distribution';
import { useNow } from '../use-analytics-data';
import { exercise, logsAt, lookupOf, renderEn } from './helpers';

const NOW = new Date(2026, 8, 26, 18, 0);
const ex = (id: string, pattern: string, muscleGroup: MuscleGroup): Exercise => ({ ...exercise(id, []), pattern, muscleGroup });

describe('patternOf with the real catalog pattern values', () => {
  const cases: Array<[string, MuscleGroup, string]> = [
    ['Leg Press', 'QUADS', 'quad'], ['Quads', 'QUADS', 'quad'], ['Squat', 'QUADS', 'quad'], ['Lunge/Split Squat', 'QUADS', 'quad'],
    ['Hip Extension', 'GLUTES', 'hinge'], ['Hip Thrust', 'GLUTES', 'hinge'], ['Hinge/RDL', 'HAMSTRINGS', 'hinge'],
    ['Crunch', 'CORE', 'core'], ['Core', 'CORE', 'core'], ['Rotation', 'CORE', 'core'],
    ['Chest', 'CHEST', 'push'], ['Shoulders', 'SHOULDERS', 'push'], ['Cable Fly', 'CHEST', 'push'], ['Horizontal Press', 'CHEST', 'push'],
    ['Pushdown', 'TRICEPS', 'push'], ['Horizontal Pull', 'BACK_HORIZONTAL', 'pull'], ['Curl', 'BICEPS', 'pull'],
    ['Pullover / Shoulder Extension', 'BACK_VERTICAL', 'pull'], ['Kickback', 'GLUTES', 'hinge'], ['Calf Raise', 'CALVES', 'other'],
    ['Scapular Upward Rotation', 'SHOULDERS', 'pull'], ['hinge-pull-overhead', 'GLUTES', 'hinge'], ['tgu-push', 'CORE', 'core'],
  ];
  it.each(cases)('%s (%s) → %s', (pattern, group, expected) => {
    expect(patternOf('x', lookupOf([ex('x', pattern, group)]))).toBe(expected);
  });

  it('leg press + leg curl logs count as legs, not push', () => {
    const lookup = lookupOf([ex('lp', 'Leg Press', 'QUADS'), ex('curl', 'Quads', 'QUADS')]);
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [
      { exerciseId: 'lp', sets: Array.from({ length: 4 }, () => ({ kg: 100, reps: 10 })) },
      { exerciseId: 'curl', sets: Array.from({ length: 3 }, () => ({ kg: 40, reps: 10 })) },
    ] }]);
    const rows = movementParity(logs, lookup, '2026-09-01');
    expect(rows.find((r) => r.pattern === 'push')!.pct).toBe(0);
    expect(rows.find((r) => r.pattern === 'quad')!.pct).toBeCloseTo(100, 6);
  });
});

describe('movementParity on-target', () => {
  it('an untrained pattern (0 %) is never on target', () => {
    const lookup = lookupOf([ex('bench', 'Horizontal Press', 'CHEST')]);
    const logs = logsAt(NOW, [1, 2, 3].map((d) => ({ daysAgo: d, exercises: [{ exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }] }] })));
    const rows = movementParity(logs, lookup, '2026-09-01');
    expect(rows.filter((r) => r.onTarget)).toHaveLength(0);
  });
});

describe('useNow (analytics clock)', () => {
  afterEach(() => vi.useRealTimers());
  it('advances while the screen stays mounted (midnight rollover)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 23, 55));
    const { result } = renderHook(() => useNow());
    expect(result.current.getDate()).toBe(27);
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(result.current.getDate()).toBe(28);
  });
});

describe('MuscleDistribution lagging link', () => {
  it('links to the library filtered by the lagging muscle group (?mg=)', () => {
    const lookup = lookupOf([exercise('bench', [{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }])]);
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }] }]);
    renderEn(<MuscleDistribution logs={logs} lookup={lookup} now={NOW} />);
    expect(screen.getByText(/Lagging muscle: Quads/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Show exercises' }).getAttribute('href')).toBe('/exercises?mg=QUADS');
  });
});

describe('LineChart caption', () => {
  it('labels the middle caption value as the best, not a bare number', () => {
    const points = [{ day: '2026-09-06', value: 80 }, { day: '2026-09-15', value: 100 }, { day: '2026-09-25', value: 90 }];
    const { container } = renderEn(<LineChart title="e1RM" points={points} format={(v) => `${v} kg`} />);
    expect(container.querySelector('figcaption')!.textContent).toContain('Best: 100 kg');
  });
});
