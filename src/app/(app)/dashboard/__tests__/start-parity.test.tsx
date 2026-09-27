/**
 * Refuter R2 (2026-09-27): "start today" on the dashboard built its draft
 * through the store's startFromProgram (no warm-ups, no muscle-impact
 * snapshot, no deload / weak-point offers), unlike /workout. The dashboard
 * now starts through the workout orchestrator: the same tap gives the same
 * draft on both screens, and the same offers.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionExercise, WorkoutDraft } from '@/contracts/domain';
import { training } from '@/lib/training';
import { ex, fakeCatalog } from '@/stores/__tests__/g3-helpers';
import { BENCH, NOW, SQUAT, TEMPLATE, installRepo } from './dashboard-harness';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));
vi.mock('@/components/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/providers')>();
  const i18n = await import('@/lib/i18n');
  type Key = Parameters<typeof i18n.t>[0];
  return { ...actual, useLocale: () => ({ locale: 'en', setLocale: () => {}, t: (k: Key) => i18n.t(k, 'en') }) };
});
const catalog = fakeCatalog([
  ex(BENCH, [['Chest', 95], ['Triceps', 65]], { name: 'Smith Flat Bench' }),
  ex(SQUAT, [['Quads', 100], ['Glutes', 70]], { name: 'Smith Back Squat', pattern: 'squat' }),
]);
vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, loadCatalog: async () => catalog };
});

const { default: DashboardPage } = await import('@/app/(app)/dashboard/page-client');
const { useWorkoutStore } = await import('@/stores/workout-store');
const { createWorkoutOrchestrator } = await import('@/stores/workout-orchestrator');

const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useWorkoutStore.setState({ draft: null });
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A profile with the dashboard program active and heavy bench history (warm-ups owed). */
async function seeded() {
  const repo = installRepo(holder);
  const me = await repo.profiles.ensureActive('Me');
  await repo.programs.create(me.id, TEMPLATE, { activate: true });
  const started = new Date(NOW.getTime() - 72 * HOUR).toISOString();
  const history: WorkoutDraft = {
    id: 'old-1',
    profileId: me.id,
    sessionName: 'Old',
    startedAt: started,
    exercises: [
      {
        uid: 'o1',
        exerciseId: BENCH,
        exerciseName: 'Smith Flat Bench',
        modality: 'tytax',
        sets: [0, 1, 2].map((i) => ({ id: `h${i}`, type: 'working' as const, kg: 100, reps: 8, rir: 3, done: true })),
      },
    ],
  };
  await repo.finishWorkout(history, { finishedAt: new Date(NOW.getTime() - 71 * HOUR).toISOString() });
  return { repo, profileId: me.id };
}

/** The draft's exercises without the per-draft ids. */
function shape(exercises: readonly SessionExercise[]) {
  return exercises.map((e) => ({ ...e, uid: '-', sets: e.sets.map((s) => ({ ...s, id: '-' })) }));
}

async function tapStart() {
  const start = await screen.findByTestId('dash-start-session');
  await waitFor(() => expect(start).toBeEnabled());
  await act(async () => {
    fireEvent.click(start);
  });
}

describe('dashboard "start today" builds the /workout draft', () => {
  it('has warm-ups and the muscle-impact snapshot, and equals the orchestrator draft', async () => {
    const { repo, profileId } = await seeded();
    render(<DashboardPage />);
    await tapStart();
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith('/workout/active'));
    const fromDashboard = useWorkoutStore.getState().draft!;
    const bench = fromDashboard.exercises.find((e) => e.exerciseId === BENCH)!;
    expect(bench.sets.some((s) => s.type === 'warmup')).toBe(true);
    expect(bench.muscleImpactSnapshot?.length).toBeGreaterThan(0);

    useWorkoutStore.getState().discard();
    const orch = createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog, now: () => NOW });
    const prepared = await orch.prepareProgramStart(profileId);
    const fromWorkout = orch.startProgram(prepared!, { deload: false, weakPoint: false });
    expect(shape(fromDashboard.exercises)).toEqual(shape(fromWorkout.exercises));
    expect(fromDashboard.programSessionId).toBe(fromWorkout.programSessionId);
    expect(fromDashboard.isDeload ?? false).toBe(false);
  });

  it('asks the deload question first when recovery is fried, and applies an accepted deload', async () => {
    await seeded();
    const real = training.recoveryStatus.bind(training);
    vi.spyOn(training, 'recoveryStatus').mockImplementation((...args) => ({ ...real(...args), overall: 'fried' }));
    render(<DashboardPage />);
    await tapStart();
    expect(await screen.findByTestId('deload-offer')).toBeInTheDocument();
    expect(useWorkoutStore.getState().draft).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('deload-accept'));
    });
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith('/workout/active'));
    expect(useWorkoutStore.getState().draft?.isDeload).toBe(true);
    expect(screen.queryByTestId('deload-offer')).toBeNull();
  });
});
