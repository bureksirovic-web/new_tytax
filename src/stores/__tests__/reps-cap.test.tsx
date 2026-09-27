/**
 * Refuter R2 (2026-09-27): a set with more than 1000 reps (the persisted-draft
 * validator's cap) was accepted by the reps field and the store, then deleted
 * with its kg/RIR/done on the next rehydrate. The field and updateSet now
 * clamp to the shared MAX_SET_REPS, so the set survives the reload.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { SetEntry } from '@/contracts/domain';
import { MAX_SET_REPS } from '@/lib/constants';
import { SetRow } from '@/components/workout/set-row';
import { useWorkoutStore } from '../workout-store';

beforeEach(() => {
  localStorage.clear();
  useWorkoutStore.getState().discard();
});
afterEach(() => cleanup());

function startWithOneSet() {
  useWorkoutStore.getState().startDraft({
    profileId: 'p',
    sessionName: 'Burpees',
    exercises: [
      { uid: 'u1', exerciseId: 'burpee', exerciseName: 'Burpee', modality: 'bodyweight', sets: [{ id: 's1', type: 'working', kg: 0, reps: 0, rir: 1, done: false }] },
    ],
  });
}

describe('reps above the cap', () => {
  it('updateSet clamps to MAX_SET_REPS and the done set survives a rehydrate', async () => {
    startWithOneSet();
    useWorkoutStore.getState().updateSet('u1', 's1', { reps: 1500 });
    useWorkoutStore.getState().toggleSetDone('u1', 's1');
    expect(useWorkoutStore.getState().draft!.exercises[0].sets[0]).toMatchObject({ reps: MAX_SET_REPS, done: true });
    await useWorkoutStore.persist.rehydrate();
    expect(useWorkoutStore.getState().draft!.exercises[0].sets).toMatchObject([{ id: 's1', reps: MAX_SET_REPS, rir: 1, done: true }]);
  });

  it('the reps field clamps typed input to MAX_SET_REPS', () => {
    const onPatch = vi.fn();
    function Harness() {
      const [set, setSet] = useState<SetEntry>({ id: 'r1', type: 'working', kg: 0, reps: 0, done: false });
      return (
        <ul>
          <SetRow
            set={set}
            number={1}
            modality="bodyweight"
            units="kg"
            onChange={(p) => {
              onPatch(p);
              setSet((s) => ({ ...s, ...p }));
            }}
            onToggleDone={vi.fn()}
            onRemove={vi.fn()}
          />
        </ul>
      );
    }
    render(<Harness />);
    const reps = screen.getByTestId('set-reps');
    fireEvent.change(reps, { target: { value: '1500' } });
    expect(onPatch).toHaveBeenLastCalledWith({ reps: MAX_SET_REPS });
    expect(reps).toHaveValue(String(MAX_SET_REPS));
  });
});
