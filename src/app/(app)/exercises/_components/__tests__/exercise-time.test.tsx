import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { Exercise, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { catalog } from '@/lib/catalog';
import { en } from '@/lib/i18n/en';
import { bestE1rm, bestHold, durationParts, longestHold } from '../history-stats';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { ExerciseDetail } = await import('../exercise-detail');

/**
 * A catalog plank. When G1's catalog already tags it `measure:'time'` it is used
 * as is; otherwise the same real entry is served with the Wave 2 field set.
 */
async function timedExercise(): Promise<Exercise> {
  const real = (await catalog.search({ modality: 'bodyweight', text: 'plank' }))[0];
  expect(real).toBeDefined();
  const timed: Exercise = { ...real, measure: 'time' };
  const orig = catalog.getById;
  vi.spyOn(catalog, 'getById').mockImplementation(async (id) => (id === real.id ? timed : orig(id)));
  return timed;
}

type HoldSet = { kg: number; seconds: number };

async function seed(repo: Repository, profileId: string, ex: Exercise, daysAgo: number, sets: HoldSet[], tag: string) {
  const log = buildWorkoutLog(
    profileId,
    { daysAgo, sessionName: tag, exercises: [{ exerciseId: ex.id, exerciseName: ex.name, sets: sets.map((s) => ({ kg: s.kg, reps: 1 })) }] },
    new Date(),
    sequentialIds(`t-${tag}`),
  );
  const exercises = log.exercises.map((e) => ({ ...e, sets: e.sets.map((s, i) => ({ ...s, durationSeconds: sets[i].seconds })) }));
  const draft: WorkoutDraft = { id: log.id, profileId, sessionName: log.sessionName, startedAt: log.startedAt, exercises };
  await repo.finishWorkout(draft, { finishedAt: log.finishedAt });
  return log.id;
}

afterEach(() => vi.restoreAllMocks());

describe('time-measured history helpers (pure)', () => {
  const set = (kg: number, reps: number, durationSeconds?: number) =>
    ({ id: 'x', type: 'working', kg, reps, done: true, durationSeconds }) as Parameters<typeof bestE1rm>[0][number];

  it('time sets never produce an e1RM; longest hold is the max whole second', () => {
    // 100×5 → 100·36/32 = 112.5 (Brzycki); the 20 kg × 60 s hold is ignored.
    expect(bestE1rm([set(100, 5), set(20, 1, 60)])).toBe(112.5);
    expect(bestE1rm([set(20, 1, 60)])).toBe(0);
    expect(longestHold([set(0, 1, 45), set(0, 1, 89.6), set(100, 5)])).toBe(90);
    expect(longestHold([set(100, 5)])).toBe(0);
  });

  it('splits durations into minutes and zero-padded seconds', () => {
    expect(durationParts(45)).toEqual({ m: 0, s: 45, ss: '45' });
    expect(durationParts(90)).toEqual({ m: 1, s: 30, ss: '30' });
    expect(durationParts(605)).toEqual({ m: 10, s: 5, ss: '05' });
    expect(durationParts(-3)).toEqual({ m: 0, s: 0, ss: '00' });
  });

  it('bestHold picks the longest session, earliest on ties', () => {
    const mk = (id: string, date: string, secs: number[]) =>
      ({ id, date, exercises: [{ exerciseId: 'p', sets: secs.map((s, i) => ({ ...set(0, 1, s), id: `${id}${i}` })) }] }) as unknown as Parameters<typeof bestHold>[0][number];
    expect(bestHold([mk('b', '2026-09-20', [60]), mk('a', '2026-09-10', [30, 60])], 'p')).toEqual({ logId: 'a', date: '2026-09-10', seconds: 60 });
    expect(bestHold([mk('a', '2026-09-10', [])], 'p')).toBeUndefined();
  });
});

describe('ExerciseDetail for a time-measured exercise', () => {
  it('lists durations, shows the longest hold and hides the e1RM chart with an explanation', async () => {
    const repo = createRepository({ db: new TytaxDatabase('ex-time-1') });
    holder.repo = repo;
    const me = await repo.profiles.ensureActive('Me');
    const ex = await timedExercise();
    const older = await seed(repo, me.id, ex, 5, [{ kg: 0, seconds: 45 }, { kg: 0, seconds: 90 }], 'Core A');
    const newer = await seed(repo, me.id, ex, 1, [{ kg: 10, seconds: 60 }], 'Core B');

    render(
      <LocaleProvider>
        <ExerciseDetail id={ex.id} />
      </LocaleProvider>,
    );
    const list = await screen.findByTestId('exercise-history');
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(2));
    // 45 s and 90 s = 1:30 min; the newer session is a 10 kg weighted 60 s hold = 1:00 min.
    expect(screen.getByTestId(`exercise-history-${older}`)).toHaveTextContent('45 s');
    expect(screen.getByTestId(`exercise-history-${older}`)).toHaveTextContent('1:30 min');
    expect(screen.getByTestId(`exercise-history-${older}`)).toHaveTextContent('Longest 1:30 min');
    expect(screen.getByTestId(`exercise-history-${newer}`)).toHaveTextContent('10 kg · 1:00 min');
    expect(screen.getByTestId(`exercise-history-${newer}`)).not.toHaveTextContent(/e1RM|×/);
    expect(screen.getByTestId('exercise-best-hold')).toHaveTextContent('1:30 min');
    expect(within(list).getByText(en.ex_history_best_hold)).toBeInTheDocument();
    expect(screen.queryByTestId('exercise-best-e1rm')).toBeNull();
    expect(screen.queryByTestId('exercise-e1rm-chart')).toBeNull();
    expect(screen.getByTestId('exercise-e1rm-na')).toHaveTextContent(en.ex_chart_time_na);
  });
});
