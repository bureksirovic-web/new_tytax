import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Exercise, ProfileSettings, SessionExercise } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';

const h = vi.hoisted(() => ({
  settings: {} as ProfileSettings,
  swapExercise: vi.fn(),
  measure: 'reps' as 'reps' | 'time',
  setupApi: { canSave: false, load: async () => undefined, save: async () => ({ saved: false, reason: 'unsupported' }) },
  getById: vi.fn(),
  lastDurations: vi.fn<(id: string) => Promise<Array<number | undefined>>>(async () => []),
  alerts: { unlock: vi.fn(() => true), vibrate: vi.fn(() => true) },
}));

vi.mock('@/hooks/use-workout', () => ({
  useWorkout: () => ({ settings: h.settings, swapExercise: h.swapExercise, setup: h.setupApi, measureOfExercise: () => h.measure, lastDurations: h.lastDurations }),
}));
vi.mock('@/hooks/use-exercises', () => ({
  useCatalog: () => ({ catalog: { getById: h.getById }, loading: false, error: undefined }),
}));
vi.mock('@/components/workout/runtime/rest-alerts', () => ({ createRestAlerts: () => h.alerts }));
vi.mock('@/components/workout/swap-sheet', () => ({
  SwapSheet: ({ exercise, onPick }: { exercise: SessionExercise; onPick: (e: Exercise) => void }) => (
    <div data-testid="swap-sheet" data-for={exercise.uid}>
      <button type="button" onClick={() => onPick(makeExercise('row', 'Row'))}>
        pick
      </button>
    </div>
  ),
}));

import { useWorkoutStore } from '@/stores/workout-store';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { SessionExerciseCard } from '../session-exercise-card';

function makeExercise(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return { id, name, modality: 'tytax', muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false, defaultSets: 2, defaultReps: '8-12', impact: [], ...extra };
}

const store = () => useWorkoutStore.getState();
const exAt = (i: number) => store().draft!.exercises[i];

function Cards() {
  const exercises = useWorkoutStore((s) => s.draft?.exercises ?? []);
  return (
    <>
      {exercises.map((ex, i) => (
        <SessionExerciseCard key={ex.uid} exercise={ex} isFirst={i === 0} isLast={i === exercises.length - 1} />
      ))}
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  h.settings = { ...DEFAULT_PROFILE_SETTINGS };
  h.swapExercise.mockReset();
  h.measure = 'reps';
  h.getById.mockReset();
  h.lastDurations.mockReset();
  h.lastDurations.mockImplementation(async () => []);
  h.alerts.unlock.mockClear();
  h.alerts.vibrate.mockClear();
  useRestTimerStore.getState().stop();
  store().startQuick('p1', 'Quick');
  store().addExercise(makeExercise('bench', 'Bench'));
});

describe('SessionExerciseCard sets', () => {
  it('binds kg/reps/RIR, add and remove (with confirm for a set with data) to the store', () => {
    render(<Cards />);
    const card = screen.getByTestId('session-exercise');
    expect(card).toHaveAttribute('data-exercise-id', 'bench');
    expect(card).toHaveAttribute('data-uid', exAt(0).uid);
    expect(within(card).getByTestId('exercise-name')).toHaveTextContent('Bench');
    // defaultSets 2 → min(2, 3) = 2 rows.
    expect(within(card).getAllByTestId('set-row')).toHaveLength(2);

    fireEvent.change(within(card).getAllByTestId('set-kg')[0], { target: { value: '80' } });
    fireEvent.change(within(card).getAllByTestId('set-reps')[0], { target: { value: '6' } });
    fireEvent.change(within(card).getAllByTestId('set-rir')[0], { target: { value: '7' } });
    // RIR clamps to 5.
    expect(exAt(0).sets[0]).toMatchObject({ kg: 80, reps: 6, rir: 5 });
    // 80 × 36 / (37 − 6) = 2880 / 31 = 92.90 → "92.9"
    expect(within(card).getAllByTestId('set-e1rm')[0]).toHaveTextContent('92.9');

    fireEvent.click(within(card).getByTestId('add-set'));
    const rows = within(card).getAllByTestId('set-row');
    expect(rows).toHaveLength(3);
    // The new row copies the last set's kg (0 here) → field stays empty.
    expect(within(rows[2]).getByTestId('set-kg')).toHaveValue('');

    // Empty set: deleted at once.
    fireEvent.click(within(rows[2]).getByTestId('remove-set'));
    expect(within(card).getAllByTestId('set-row')).toHaveLength(2);
    // Set with data: asks first; cancel keeps it, confirm deletes it.
    fireEvent.click(within(card).getAllByTestId('remove-set')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(exAt(0).sets).toHaveLength(2);
    fireEvent.click(within(card).getAllByTestId('remove-set')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(exAt(0).sets).toHaveLength(1);
    expect(exAt(0).sets[0].kg).toBe(0);
  });

  it('enables done only with kg and reps, starts rest + alerts, focuses the next kg, and can undo', () => {
    h.settings = { ...DEFAULT_PROFILE_SETTINGS, restSeconds: 75 };
    render(<Cards />);
    const [row0, row1] = screen.getAllByTestId('set-row');
    const done = within(row0).getByTestId('set-done');
    expect(done).toBeDisabled();
    fireEvent.change(within(row0).getByTestId('set-kg'), { target: { value: '100' } });
    expect(done).toBeDisabled();
    fireEvent.change(within(row0).getByTestId('set-reps'), { target: { value: '5' } });
    expect(done).toBeEnabled();

    fireEvent.click(done);
    expect(row0).toHaveAttribute('data-done', 'true');
    expect(done).toHaveAttribute('aria-pressed', 'true');
    expect(useRestTimerStore.getState().timer?.totalS).toBe(75);
    expect(h.alerts.unlock).toHaveBeenCalledTimes(1);
    expect(h.alerts.vibrate).toHaveBeenCalledWith([50]);
    expect(document.activeElement).toBe(within(row1).getByTestId('set-kg'));

    useRestTimerStore.getState().stop();
    fireEvent.click(done);
    expect(row0).toHaveAttribute('data-done', 'false');
    expect(useRestTimerStore.getState().timer).toBeNull();
    expect(h.alerts.vibrate).toHaveBeenCalledTimes(1);
  });

  it('Enter in kg moves to reps, Enter in reps marks done; exercise rest wins over the profile', () => {
    store().replaceExercises([{ ...exAt(0), restSeconds: 150 }]);
    render(<Cards />);
    const row0 = screen.getAllByTestId('set-row')[0];
    const kg = within(row0).getByTestId('set-kg');
    fireEvent.change(kg, { target: { value: '60' } });
    fireEvent.keyDown(kg, { key: 'Enter' });
    const reps = within(row0).getByTestId('set-reps');
    expect(document.activeElement).toBe(reps);
    fireEvent.keyDown(reps, { key: 'Enter' });
    // No reps yet → nothing happens.
    expect(row0).toHaveAttribute('data-done', 'false');
    fireEvent.change(reps, { target: { value: '8' } });
    fireEvent.keyDown(reps, { key: 'Enter' });
    expect(row0).toHaveAttribute('data-done', 'true');
    expect(useRestTimerStore.getState().timer?.totalS).toBe(150);
  });

  it('allows 0 kg for bodyweight work', () => {
    store().startQuick('p1', 'Quick');
    store().addExercise(makeExercise('pushup', 'Push-up', { modality: 'bodyweight' }));
    render(<Cards />);
    const row0 = screen.getAllByTestId('set-row')[0];
    fireEvent.change(within(row0).getByTestId('set-reps'), { target: { value: '15' } });
    expect(within(row0).getByTestId('set-done')).toBeEnabled();
    fireEvent.click(within(row0).getByTestId('set-done'));
    expect(exAt(0).sets[0]).toMatchObject({ kg: 0, reps: 15, done: true });
  });

  it('shows ghost placeholders and flags beating the ghost reps', () => {
    const se = exAt(0);
    store().replaceExercises([{ ...se, sets: se.sets.map((s) => ({ ...s, ghostKg: 100, ghostReps: 8 })) }]);
    render(<Cards />);
    const reps = screen.getAllByTestId('set-reps')[0];
    expect(reps).toHaveAttribute('placeholder', '8');
    expect(screen.getAllByTestId('set-kg')[0]).toHaveAttribute('placeholder', '100');
    fireEvent.change(reps, { target: { value: '8' } });
    expect(reps).toHaveAttribute('data-beat', 'false');
    fireEvent.change(reps, { target: { value: '9' } });
    expect(reps).toHaveAttribute('data-beat', 'true');
    expect(reps.className).toContain('emerald');
  });

  it('displays and accepts weights in lb while storing kg', () => {
    h.settings = { ...DEFAULT_PROFILE_SETTINGS, units: 'lb' };
    store().updateSet(exAt(0).uid, exAt(0).sets[0].id, { kg: 100 });
    render(<Cards />);
    const kg = screen.getAllByTestId('set-kg');
    // 100 kg × 2.20462 = 220.462 → 220.5 lb
    expect(kg[0]).toHaveValue('220.5');
    fireEvent.change(kg[1], { target: { value: '225' } });
    // 225 / 2.20462 = 102.058 kg
    expect(exAt(0).sets[1].kg).toBeCloseTo(102.058, 3);
    // A quarter-pound entry is kept as typed although the display rounds to 0.1 lb.
    fireEvent.change(kg[1], { target: { value: '102.25' } });
    expect(kg[1]).toHaveValue('102.25');
    expect(exAt(0).sets[1].kg).toBeCloseTo(102.25 / 2.20462, 3);
  });

  it('shows the clamped value even when the store already holds it', () => {
    render(<Cards />);
    const rir = screen.getAllByTestId('set-rir')[0];
    fireEvent.change(rir, { target: { value: '5' } });
    fireEvent.change(rir, { target: { value: '57' } });
    expect(exAt(0).sets[0].rir).toBe(5);
    expect(rir).toHaveValue('5');
    const kg = screen.getAllByTestId('set-kg')[0];
    fireEvent.change(kg, { target: { value: '-5' } });
    expect(exAt(0).sets[0].kg).toBe(0);
    expect(kg).toHaveValue('');
  });
});

describe('SessionExerciseCard warm-ups and exercise actions', () => {
  it('adds warm-ups from the heaviest working kg once, labelled as warm-ups', () => {
    render(<Cards />);
    const addWarmup = screen.getByTestId('add-warmup');
    expect(addWarmup).toBeDisabled();
    fireEvent.change(screen.getAllByTestId('set-kg')[1], { target: { value: '100' } });
    fireEvent.click(addWarmup);
    const rows = screen.getAllByTestId('set-row');
    // standard: 100 × 0.5 = 50 × 10, 100 × 0.75 = 75 × 5, then the 2 working sets
    expect(rows.map((r) => r.getAttribute('data-set-type'))).toEqual(['warmup', 'warmup', 'working', 'working']);
    expect(exAt(0).sets.slice(0, 2).map((s) => [s.kg, s.reps])).toEqual([[50, 10], [75, 5]]);
    expect(rows[0]).toHaveAccessibleName('Warm-up 1');
    expect(rows[2]).toHaveAccessibleName('Set 1');
    expect(addWarmup).toBeDisabled();
  });

  it("uses one 50% warm-up for strategy 'none'", () => {
    h.settings = { ...DEFAULT_PROFILE_SETTINGS, warmupStrategy: 'none' };
    render(<Cards />);
    fireEvent.change(screen.getAllByTestId('set-kg')[0], { target: { value: '90' } });
    fireEvent.click(screen.getByTestId('add-warmup'));
    expect(exAt(0).sets[0]).toMatchObject({ type: 'warmup', kg: 45, reps: 10, done: false });
    expect(exAt(0).sets).toHaveLength(3);
  });

  it('renders the same exercise twice independently, reorders and removes', () => {
    store().addExercise(makeExercise('bench', 'Bench'));
    render(<Cards />);
    const cards = screen.getAllByTestId('session-exercise');
    expect(cards).toHaveLength(2);
    const [uidA, uidB] = [exAt(0).uid, exAt(1).uid];
    expect(uidA).not.toBe(uidB);
    fireEvent.change(within(cards[1]).getAllByTestId('set-kg')[0], { target: { value: '70' } });
    expect(exAt(0).sets[0].kg).toBe(0);
    expect(exAt(1).sets[0].kg).toBe(70);

    expect(within(cards[0]).getByTestId('move-exercise-up')).toBeDisabled();
    fireEvent.click(within(cards[0]).getByTestId('move-exercise-down'));
    expect(store().draft!.exercises.map((e) => e.uid)).toEqual([uidB, uidA]);
    fireEvent.click(within(screen.getAllByTestId('session-exercise')[0]).getByTestId('remove-exercise'));
    expect(store().draft!.exercises.map((e) => e.uid)).toEqual([uidA]);
  });

  it('asks before removing an exercise with a done set; cancel keeps it', () => {
    store().updateSet(exAt(0).uid, exAt(0).sets[0].id, { kg: 80, reps: 6, done: true });
    render(<Cards />);
    fireEvent.click(screen.getByTestId('remove-exercise'));
    expect(screen.getByText(/Bench has done sets/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store().draft!.exercises).toHaveLength(1);
    fireEvent.click(screen.getByTestId('remove-exercise'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(store().draft!.exercises).toHaveLength(0);
  });

  it('opens the swap sheet and swaps through useWorkout', () => {
    render(<Cards />);
    expect(screen.queryByTestId('swap-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('swap-exercise'));
    expect(screen.getByTestId('swap-sheet')).toHaveAttribute('data-for', exAt(0).uid);
    fireEvent.click(screen.getByText('pick'));
    expect(h.swapExercise).toHaveBeenCalledWith(exAt(0).uid, expect.objectContaining({ id: 'row' }));
    expect(screen.queryByTestId('swap-sheet')).toBeNull();
  });

  it('resolves the video from the catalog entry', () => {
    h.getById.mockReturnValue(makeExercise('bench', 'Bench', { videos: [{ url: 'https://app.tytax.com/v/9', label: 'TYTAX' }] }));
    render(<Cards />);
    expect(h.getById).toHaveBeenCalledWith('bench');
    expect(screen.getByTestId('video-button')).toHaveAttribute('href', 'https://app.tytax.com/v/9');
  });
});

describe('SessionExerciseCard time sets (Wave 2)', () => {
  it('a time exercise shows duration rows; done needs seconds > 0, completes via toggleTimeSetDone and starts the rest', () => {
    h.measure = 'time';
    render(<Cards />);
    const card = screen.getByTestId('session-exercise');
    expect(within(card).queryAllByTestId('set-kg')).toHaveLength(0);
    const duration = within(card).getAllByTestId('set-duration')[0];
    const done = within(card).getAllByTestId('set-done')[0];
    expect(done).toBeDisabled();

    fireEvent.change(duration, { target: { value: '45' } });
    fireEvent.blur(duration);
    expect(exAt(0).sets[0].durationSeconds).toBe(45);
    expect(duration).toHaveValue('0:45');
    expect(done).toBeEnabled();

    fireEvent.click(done);
    expect(exAt(0).sets[0].done).toBe(true);
    // 90 s: the profile default (DEFAULT_PROFILE_SETTINGS.restSeconds); the exercise names none.
    expect(useRestTimerStore.getState().timer?.totalS).toBe(90);
    // Focus moves to the next set's duration input.
    expect(within(card).getAllByTestId('set-duration')[1]).toHaveFocus();

    fireEvent.click(done);
    expect(exAt(0).sets[0].done).toBe(false);
    expect(exAt(0).sets[0].durationSeconds).toBe(45);
  });

  it("a time exercise shows last session's duration per working set as the ghost", async () => {
    h.measure = 'time';
    // Last session: set 1 held 45 s, set 2 not done (undefined), so only row 1 gets a ghost.
    h.lastDurations.mockImplementation(async () => [45, undefined]);
    render(<Cards />);
    const rows = await screen.findAllByPlaceholderText('0:45');
    expect(rows).toHaveLength(1);
    expect(h.lastDurations).toHaveBeenCalledWith('bench');
    const durations = screen.getAllByTestId('set-duration');
    expect(durations[0]).toHaveAccessibleName('Set 1: Duration (seconds or m:ss). Last time 0:45');
    expect(durations[1]).toHaveAttribute('placeholder', 'sec');
  });

  it("a time set's own ghostDurationSeconds (from the session builder) is the placeholder", async () => {
    h.measure = 'time';
    // No loaded history at all: the hint on the set alone drives the placeholder (row 1 only).
    const se = exAt(0);
    store().replaceExercises([{ ...se, sets: se.sets.map((s, i) => (i === 0 ? { ...s, ghostDurationSeconds: 50 } : s)) }]);
    render(<Cards />);
    const rows = await screen.findAllByPlaceholderText('0:50');
    expect(rows).toHaveLength(1);
    expect(screen.getAllByTestId('set-duration')[0]).toHaveAccessibleName('Set 1: Duration (seconds or m:ss). Last time 0:50');
  });

  it('a reps exercise never loads last durations', () => {
    render(<Cards />);
    expect(screen.getAllByTestId('set-kg').length).toBeGreaterThan(0);
    expect(h.lastDurations).not.toHaveBeenCalled();
  });
});
