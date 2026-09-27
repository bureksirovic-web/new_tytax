import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Exercise, MachineSetup, ProfileSettings } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { SaveSetupResult } from '@/stores/setup-adapter';

const h = vi.hoisted(() => ({
  settings: {} as ProfileSettings,
  stored: undefined as MachineSetup | undefined,
  canSave: true,
  load: vi.fn(),
  save: vi.fn(),
}));

// Like the real hook, `setup` is stable across renders (memoised on repo + profile).
const api = { get canSave() { return h.canSave; }, load: (id: string) => h.load(id), save: (id: string, s: MachineSetup | undefined) => h.save(id, s) };
vi.mock('@/hooks/use-workout', () => ({
  useWorkout: () => ({ settings: h.settings, swapExercise: vi.fn(), setup: api, measureOfExercise: () => 'reps' }),
}));
vi.mock('@/hooks/use-exercises', () => ({
  useCatalog: () => ({ catalog: { getById: () => undefined }, loading: false, error: undefined }),
}));

import { useWorkoutStore } from '@/stores/workout-store';
import { SessionExerciseCard } from '../session-exercise-card';
import { SetupSheet } from '../setup-sheet';
import { SetupSummary } from '../setup-summary';

function makeExercise(id: string, name: string): Exercise {
  return { id, name, modality: 'tytax', muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false, defaultSets: 1, defaultReps: '8-12', impact: [] };
}

function Card() {
  const ex = useWorkoutStore((s) => s.draft?.exercises[0]);
  return ex ? <SessionExerciseCard exercise={ex} isFirst isLast /> : null;
}

beforeEach(() => {
  localStorage.clear();
  h.settings = { ...DEFAULT_PROFILE_SETTINGS };
  h.stored = undefined;
  h.canSave = true;
  h.load.mockReset().mockImplementation(async () => h.stored);
  h.save.mockReset().mockImplementation(async (_id: string, setup: MachineSetup | undefined): Promise<SaveSetupResult> => ({ saved: true, setup }));
  useWorkoutStore.getState().startQuick('p1', 'Quick');
  useWorkoutStore.getState().addExercise(makeExercise('press', 'Chest Press'));
});

describe('SetupSummary', () => {
  it('lists only the filled fields, in field order', () => {
    render(<SetupSummary setup={{ other: 'rope', seat: '4', pin: '  ', benchAngle: '30°' }} />);
    const dl = screen.getByTestId('exercise-setup');
    expect(dl).toHaveAccessibleName('Machine setup');
    expect(within(dl).getAllByRole('term').map((el) => el.textContent)).toEqual(['Seat', 'Bench angle', 'Other']);
    expect(within(dl).getAllByRole('definition').map((el) => el.textContent)).toEqual(['4', '30°', 'rope']);
  });

  it('renders nothing for a setup without filled fields', () => {
    render(<SetupSummary setup={{ seat: '' }} />);
    expect(screen.queryByTestId('exercise-setup')).not.toBeInTheDocument();
  });
});

describe('machine setup on the exercise card', () => {
  it('shows the stored setup for the exercise and hides it when there is none', async () => {
    h.stored = { seat: '4', cable: 'high' };
    render(<Card />);
    const setup = await screen.findByTestId('exercise-setup');
    expect(h.load).toHaveBeenCalledWith('press');
    expect(setup).toHaveTextContent('Seat4');
    expect(setup).toHaveTextContent('Cablehigh');
    expect(within(setup).queryByText('Pin')).not.toBeInTheDocument();
  });

  it('no stored setup: no summary, but the edit button is there', async () => {
    render(<Card />);
    await waitFor(() => expect(h.load).toHaveBeenCalled());
    expect(screen.queryByTestId('exercise-setup')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-setup')).toHaveAccessibleName('Chest Press: Edit machine setup');
  });

  it('edit → save writes via useWorkout().setup.save, closes the sheet and shows the saved setup', async () => {
    h.stored = { seat: '4' };
    render(<Card />);
    await screen.findByTestId('exercise-setup');
    const opener = screen.getByTestId('edit-setup');
    opener.focus();
    fireEvent.click(opener);
    const sheet = screen.getByTestId('setup-sheet');
    expect(sheet).toHaveAttribute('role', 'dialog');
    expect(within(sheet).getByTestId('setup-seat')).toHaveValue('4');
    // useDialogFocus moves focus into the sheet.
    expect(sheet.contains(document.activeElement)).toBe(true);
    fireEvent.change(within(sheet).getByTestId('setup-pin'), { target: { value: '7' } });
    fireEvent.change(within(sheet).getByTestId('setup-seat'), { target: { value: '5' } });
    await act(async () => {
      fireEvent.click(within(sheet).getByTestId('setup-save'));
    });
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.save.mock.calls[0][0]).toBe('press');
    expect(h.save.mock.calls[0][1]).toMatchObject({ seat: '5', pin: '7', backrest: '', benchAngle: '', cable: '', other: '' });
    expect(screen.queryByTestId('setup-sheet')).not.toBeInTheDocument();
    // The summary shows what the save returned.
    expect(screen.getByTestId('exercise-setup')).toHaveTextContent('Seat5');
    expect(screen.getByTestId('exercise-setup')).toHaveTextContent('Pin7');
    // Focus returns to the opener.
    expect(document.activeElement).toBe(opener);
  });

  it('save unsupported (canSave false): read-only fields, notice, disabled save, nothing written', async () => {
    h.canSave = false;
    h.stored = { seat: '4' };
    render(<Card />);
    await screen.findByTestId('exercise-setup');
    fireEvent.click(screen.getByTestId('edit-setup'));
    const sheet = screen.getByTestId('setup-sheet');
    expect(within(sheet).getByTestId('setup-readonly')).toHaveTextContent('not available on this device');
    expect(within(sheet).getByTestId('setup-seat')).toHaveAttribute('readonly');
    expect(within(sheet).getByTestId('setup-save')).toBeDisabled();
    fireEvent.submit(within(sheet).getByTestId('setup-seat').closest('form')!);
    expect(h.save).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('setup-sheet')).not.toBeInTheDocument();
  });
});

describe('SetupSheet results', () => {
  function renderSheet(result: SaveSetupResult | Error) {
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    render(<SetupSheet exerciseName="Row" setup={undefined} canSave onSave={onSave} onClose={onClose} />);
    return { onClose, onSave };
  }

  it('a save answering unsupported switches to the read-only notice and stays open', async () => {
    const { onClose } = renderSheet({ saved: false, reason: 'unsupported' });
    expect(screen.queryByTestId('setup-readonly')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Setup: Row');
    await act(async () => {
      fireEvent.click(screen.getByTestId('setup-save'));
    });
    expect(screen.getByTestId('setup-readonly')).toBeInTheDocument();
    expect(screen.getByTestId('setup-save')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['an error result', { saved: false, reason: 'error', error: new Error('x') } as SaveSetupResult],
    ['a throwing save', new Error('boom')],
  ])('%s shows an alert, keeps the values and allows a retry', async (_label, result) => {
    const { onClose, onSave } = renderSheet(result);
    fireEvent.change(screen.getByTestId('setup-cable'), { target: { value: 'low' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('setup-save'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the setup');
    expect(screen.getByTestId('setup-cable')).toHaveValue('low');
    expect(screen.getByTestId('setup-save')).toBeEnabled();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Enter in a field submits; inputs are labelled and length-capped', async () => {
    const { onClose, onSave } = renderSheet({ saved: true, setup: { other: 'x' } });
    const other = screen.getByLabelText('Other');
    expect(other).toHaveAttribute('data-testid', 'setup-other');
    expect(other).toHaveAttribute('maxlength', '40');
    fireEvent.change(other, { target: { value: 'x' } });
    await act(async () => {
      fireEvent.submit(other.closest('form')!);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
