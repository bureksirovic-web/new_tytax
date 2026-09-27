import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Exercise, Program, WorkoutDraft } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { UseWorkoutResult } from '@/hooks/use-workout';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ensureActive = vi.fn(async () => ({ id: 'fresh' }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => ({ profiles: { ensureActive } }) };
});

const hook = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('@/hooks/use-workout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-workout')>();
  return { ...actual, useWorkout: () => hook.current };
});

import { useWorkoutStore } from '@/stores/workout-store';
import WorkoutPage from '@/app/(app)/workout/page-client';

const pushDay: Program['sessions'][number] = {
  id: 's-push', programId: 'prog', name: 'Push A', dayIndex: 0,
  exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: 3, reps: '8' }],
};
const restDay: Program['sessions'][number] = { id: 's-rest', programId: 'prog', name: 'Recovery', dayIndex: 1, exercises: [], isRest: true };

function program(currentSessionIndex: number): Program {
  return {
    id: 'prog', profileId: 'p1', name: 'PPL', splitType: 'custom', frequency: 2, periodizationType: 'none',
    sessionOrder: [], sessions: [pushDay, restDay], modalitiesUsed: ['tytax'], isPreset: false,
    currentSessionIndex, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const DRAFT: WorkoutDraft = { id: 'd1', profileId: 'p1', sessionName: 'Leg day', startedAt: '2026-09-26T10:00:00.000Z', exercises: [] };
const rearDelt = { id: 'rd', name: 'Rear Delt Fly' } as Exercise;

function makeHook(over: Partial<UseWorkoutResult> = {}): UseWorkoutResult {
  return {
    ready: true, profile: undefined, profileId: 'p1', settings: DEFAULT_PROFILE_SETTINGS, draft: null,
    activeProgram: undefined, nextSession: null,
    startQuick: vi.fn(() => DRAFT), prepareProgramStart: vi.fn(async () => ({ offers: {} })),
    startProgram: vi.fn(async () => DRAFT), addExercise: vi.fn(async () => 'u1'), swapExercise: vi.fn(async () => 'u1'),
    finish: vi.fn(), skipRestDay: vi.fn(async () => null),
    activeProgramLoading: false, foreignDraft: false, draftOwner: undefined, switchToDraftOwner: vi.fn(async () => undefined),
    orderByStation: vi.fn(async () => false), repeatLog: vi.fn(() => null), measureOfExercise: vi.fn(() => 'reps' as const),
    lastDurations: vi.fn(async (): Promise<Array<number | undefined>> => []),
    setup: { canSave: false, load: vi.fn(async () => undefined), save: vi.fn(async () => ({ saved: false as const, reason: 'unsupported' as const })) },
    ...over,
  };
}

async function click(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
}

describe('workout start page', () => {
  beforeEach(() => {
    router.push.mockReset();
    ensureActive.mockClear();
    useWorkoutStore.getState().discard();
  });

  it('marks its only h1 with page-heading-workout (G4-02)', () => {
    hook.current = makeHook();
    render(<WorkoutPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toBe(screen.getByTestId('page-heading-workout'));
    expect(headings[0].textContent?.trim()).not.toBe('');
  });

  it('starts a quick workout with the localized session name', async () => {
    const h = makeHook();
    hook.current = h;
    render(<WorkoutPage />);
    await click('start-quick-workout');
    expect(h.startQuick).toHaveBeenCalledWith('Quick workout');
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('creates the default profile on a fresh device before a quick start', async () => {
    hook.current = makeHook({ profileId: undefined });
    render(<WorkoutPage />);
    await click('start-quick-workout');
    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().draft?.profileId).toBe('fresh');
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('shows a rest session as a rest day that cannot start, and skips it', async () => {
    const h = makeHook({ activeProgram: program(1) });
    hook.current = h;
    render(<WorkoutPage />);
    expect(screen.getByTestId('next-session-name')).toHaveTextContent('Recovery');
    expect(screen.getByTestId('next-session-rest')).toHaveTextContent('Rest day');
    expect(screen.queryByTestId('start-program-workout')).toBeNull();
    await click('complete-rest-day');
    expect(h.skipRestDay).toHaveBeenCalledTimes(1);
    expect(h.prepareProgramStart).not.toHaveBeenCalled();
  });

  it('youth mode: a rest day reached today stays locked (disabled + hint), never hidden', async () => {
    const today = { ...program(1), updatedAt: new Date().toISOString() };
    const h = makeHook({ activeProgram: today, profile: { birthYear: new Date().getFullYear() - 11 } as UseWorkoutResult['profile'] });
    hook.current = h;
    render(<WorkoutPage />);
    expect(screen.getByTestId('next-session-rest')).toHaveTextContent('Rest day');
    expect(screen.getByTestId('complete-rest-day')).toBeDisabled();
    expect(screen.getByTestId('rest-day-locked')).toBeInTheDocument();
  });

  it('youth mode: a rest day reached on an earlier day can be marked done (the rotation never gets stuck)', async () => {
    const h = makeHook({ activeProgram: program(1), profile: { birthYear: new Date().getFullYear() - 11 } as UseWorkoutResult['profile'] });
    hook.current = h;
    render(<WorkoutPage />);
    expect(screen.getByTestId('complete-rest-day')).toBeEnabled();
    expect(screen.queryByTestId('rest-day-locked')).toBeNull();
    await click('complete-rest-day');
    expect(h.skipRestDay).toHaveBeenCalled();
  });

  it('starts a program session without offers straight away', async () => {
    const h = makeHook({ activeProgram: program(0) });
    hook.current = h;
    render(<WorkoutPage />);
    expect(screen.getByTestId('next-session-name')).toHaveTextContent('Push A');
    expect(screen.queryByTestId('next-session-rest')).toBeNull();
    await click('start-program-workout');
    expect(h.startProgram).toHaveBeenCalledWith({ deload: false, weakPoint: false });
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it.each([
    ['deload-accept', true],
    ['deload-decline', false],
  ])('asks about a deload first (%s)', async (button, deload) => {
    const recovery = { overall: 'fried' } as never;
    const h = makeHook({ activeProgram: program(0), prepareProgramStart: vi.fn(async () => ({ offers: { deload: { recovery } } })) });
    hook.current = h;
    render(<WorkoutPage />);
    await click('start-program-workout');
    expect(screen.getByTestId('deload-offer')).toHaveTextContent('15%');
    expect(h.startProgram).not.toHaveBeenCalled();
    await click(button);
    expect(screen.queryByTestId('deload-offer')).toBeNull();
    expect(h.startProgram).toHaveBeenCalledWith({ deload, weakPoint: false });
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('offers the weak point naming muscle and exercise, then starts with it', async () => {
    const weakPoint = { muscle: 'Rear Delts', exercise: rearDelt, sets: 2 as const, sessionExercise: {} as never };
    const h = makeHook({ activeProgram: program(0), prepareProgramStart: vi.fn(async () => ({ offers: { weakPoint } })) });
    hook.current = h;
    render(<WorkoutPage />);
    await click('start-program-workout');
    const offer = screen.getByTestId('weak-point-offer');
    expect(offer).toHaveTextContent('Rear Delts');
    expect(offer).toHaveTextContent('Rear Delt Fly');
    expect(offer).toHaveTextContent('2 sets');
    await click('weak-point-accept');
    expect(h.startProgram).toHaveBeenCalledWith({ deload: false, weakPoint: true });
  });

  it('asks both offers in order when both exist, and Escape abandons the start', async () => {
    const weakPoint = { muscle: 'Calves', exercise: rearDelt, sets: 2 as const, sessionExercise: {} as never };
    const offers = { deload: { recovery: {} as never }, weakPoint };
    const h = makeHook({ activeProgram: program(0), prepareProgramStart: vi.fn(async () => ({ offers })) });
    hook.current = h;
    render(<WorkoutPage />);
    await click('start-program-workout');
    await click('deload-decline');
    await click('weak-point-decline');
    expect(h.startProgram).toHaveBeenCalledWith({ deload: false, weakPoint: false });

    await click('start-program-workout');
    expect(screen.getByTestId('deload-offer')).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByTestId('deload-offer')).toBeNull();
    expect(h.startProgram).toHaveBeenCalledTimes(1);
  });

  it('shows an error when preparing the program start fails', async () => {
    hook.current = makeHook({ activeProgram: program(0), prepareProgramStart: vi.fn(async () => Promise.reject(new Error('x'))) });
    render(<WorkoutPage />);
    await click('start-program-workout');
    expect(screen.getByTestId('start-error')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByTestId('start-program-workout')).not.toBeDisabled();
  });

  it('continues an existing draft and discards it only after confirmation', async () => {
    useWorkoutStore.setState({ draft: DRAFT });
    hook.current = makeHook({ draft: DRAFT });
    render(<WorkoutPage />);
    expect(screen.getByTestId('continue-workout')).toHaveAttribute('href', '/workout/active');
    expect(screen.queryByTestId('start-quick-workout')).toBeNull();

    await click('discard-workout');
    expect(screen.getByTestId('discard-confirm-dialog')).toHaveTextContent('Leg day');
    await click('discard-cancel');
    expect(useWorkoutStore.getState().draft).toEqual(DRAFT);

    await click('discard-workout');
    await click('discard-confirm');
    expect(useWorkoutStore.getState().draft).toBeNull();
  });

  it('shows nothing actionable until the hook is ready', () => {
    hook.current = makeHook({ ready: false });
    render(<WorkoutPage />);
    expect(screen.queryByTestId('start-quick-workout')).toBeNull();
    expect(screen.getByTestId('workout-home').querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId('current-draft')).toBeNull();
  });
});
