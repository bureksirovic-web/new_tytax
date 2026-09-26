import { describe, expect, it } from 'vitest';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { training } from '@/lib/training';
import { fromLog, hasErrors, newSet, toPatch, validate } from '../edit-model';

const NOW = new Date(2026, 8, 16, 18, 0, 0);

function log() {
  return buildWorkoutLog(
    'p1',
    {
      daysAgo: 1,
      rpe: 8,
      notes: 'good',
      exercises: [
        {
          exerciseId: 'bench',
          sets: [
            { kg: 40, reps: 10, type: 'warmup' },
            { kg: 100, reps: 5, rir: 2 },
          ],
        },
      ],
    },
    NOW,
    sequentialIds('e'),
  );
}

describe('edit model', () => {
  it('shows weights in the display unit and keeps untouched kg exact in lb', () => {
    const source = log();
    const draft = fromLog(source, 'lb');
    // 100 kg × 2.20462 = 220.462 → 220.5 lb
    expect(draft.exercises[0].sets[1].kg).toBe('220.5');
    const patch = toPatch(draft, 'lb');
    // Unchanged text → the stored 100 kg, not 220.5 / 2.20462 = 100.02.
    expect(patch.exercises[0].sets[1].kg).toBe(100);
  });

  it('converts an edited lb value back to kg', () => {
    const draft = fromLog(log(), 'lb');
    draft.exercises[0].sets[1].kg = '225';
    const set = toPatch(draft, 'lb').exercises[0].sets[1];
    // 225 / 2.20462 = 102.058… → rounded to 0.01 → 102.06 kg
    expect(set.kg).toBe(102.06);
    expect(set.e1rm).toBe(training.e1rm(102.06, 5));
  });

  it('clears notes and RPE when emptied; keeps RIR empty as undefined', () => {
    const draft = fromLog(log(), 'kg');
    draft.notes = '  ';
    draft.rpe = '';
    draft.exercises[0].sets[1].rir = '';
    const patch = toPatch(draft, 'kg');
    expect(patch.notes).toBeUndefined();
    expect(patch.rpe).toBeUndefined();
    expect(patch.exercises[0].sets[1].rir).toBeUndefined();
  });

  it('flags invalid kg, reps, rpe and future dates', () => {
    const draft = fromLog(log(), 'kg');
    const today = '2026-09-16';
    expect(hasErrors(validate(draft, 'kg', today))).toBe(false);
    draft.exercises[0].sets[1].kg = '1001';
    draft.exercises[0].sets[0].reps = '2.5';
    draft.rpe = '11';
    draft.date = '2026-09-17';
    const errors = validate(draft, 'kg', today);
    const [warm, work] = draft.exercises[0].sets;
    expect(errors.sets[work.id]).toEqual({ kg: true });
    expect(errors.sets[warm.id]).toEqual({ reps: true });
    expect(errors.rpe).toBe(true);
    expect(errors.date).toBe(true);
  });

  it('checks the 1000 kg cap in kg even when entering lb', () => {
    const draft = fromLog(log(), 'lb');
    // 2200 lb = 997.9 kg (ok); 2210 lb = 1002.4 kg (too heavy)
    draft.exercises[0].sets[1].kg = '2200';
    expect(hasErrors(validate(draft, 'lb', '2026-09-16'))).toBe(false);
    draft.exercises[0].sets[1].kg = '2210';
    expect(hasErrors(validate(draft, 'lb', '2026-09-16'))).toBe(true);
  });

  it('a new set copies the last set and is done', () => {
    const ex = fromLog(log(), 'kg').exercises[0];
    expect(newSet(ex, 'n1')).toEqual({ id: 'n1', type: 'working', kg: '100', reps: '5', rir: '', done: true });
    const set = toPatch({ ...fromLog(log(), 'kg'), exercises: [{ ...ex, sets: [...ex.sets, newSet(ex, 'n1')] }] }, 'kg')
      .exercises[0].sets[2];
    expect(set).toMatchObject({ id: 'n1', kg: 100, reps: 5, done: true, type: 'working' });
  });
});
