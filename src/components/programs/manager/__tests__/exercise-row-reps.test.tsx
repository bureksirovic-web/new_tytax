import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ProgramExercise } from '@/contracts/domain';
import { getPresetById } from '@/lib/programs/presets';
import { ExerciseRow } from '../exercise-row';

function renderRow(slot: ProgramExercise) {
  const onPatch = vi.fn();
  render(
    <ul>
      <ExerciseRow slot={slot} index={0} count={1} onMove={() => {}} onRemove={() => {}} onPatch={onPatch} />
    </ul>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'prog_edit_named' }));
  return onPatch;
}

describe('ExerciseRow reps (refuter2 #3)', () => {
  it('a shipped preset slot with a timed target (30-45s) is valid and can be saved', () => {
    const slot = getPresetById('bw-fundamentals')?.sessions.flatMap((s) => s.exercises).find((e) => /s$|s\/side$/.test(e.reps));
    expect(slot).toBeDefined();
    const onPatch = renderRow(slot as ProgramExercise);
    expect(screen.getByLabelText('prog_reps')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'prog_done' }));
    expect(onPatch).toHaveBeenCalledWith(0, expect.objectContaining({ reps: slot?.reps }));
  });

  it('stores the normalised range and blocks invalid input', () => {
    const onPatch = renderRow({ exerciseId: 'x', exerciseName: 'X', modality: 'tytax', sets: 3, reps: '8' });
    const input = screen.getByLabelText('prog_reps');
    fireEvent.change(input, { target: { value: '8-' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'prog_done' })).toBeDisabled();
    fireEvent.change(input, { target: { value: ' 10 - 12 / side ' } });
    fireEvent.click(screen.getByRole('button', { name: 'prog_done' }));
    expect(onPatch).toHaveBeenCalledWith(0, expect.objectContaining({ reps: '10-12/side' }));
  });
});
