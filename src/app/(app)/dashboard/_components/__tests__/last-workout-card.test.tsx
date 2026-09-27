import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';

vi.mock('@/components/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/providers')>();
  const i18n = await import('@/lib/i18n');
  type Key = Parameters<typeof i18n.t>[0];
  return { ...actual, useLocale: () => ({ locale: 'en', setLocale: () => {}, t: (k: Key) => i18n.t(k, 'en') }) };
});

const { LastWorkoutCard } = await import('../last-workout-card');
const { durationMinutes } = await import('@/components/history/log-math');

afterEach(cleanup);

const NOW = new Date('2026-09-20T10:00:00');

function logOf(durationSeconds: number) {
  return buildWorkoutLog(
    'p1',
    { daysAgo: 1, durationSeconds, exercises: [{ exerciseId: 'bench', sets: [{ kg: 60, reps: 5 }] }] },
    NOW,
    sequentialIds('x')
  );
}

describe('LastWorkoutCard duration', () => {
  it.each([
    [1780, 29],
    [20, 1],
    [0, 1],
    [3599, 59],
  ])('%is renders the same minutes as history (%i min)', (seconds, expected) => {
    expect(durationMinutes(seconds)).toBe(expected);
    render(<LastWorkoutCard log={logOf(seconds)} units="kg" />);
    const stats = screen.getByTestId('dash-last-workout').querySelector('#dash-last-stats');
    expect(stats?.textContent).toContain(`${expected} min`);
    expect(stats?.textContent).not.toContain(`${expected + 1} min`);
  });
});
