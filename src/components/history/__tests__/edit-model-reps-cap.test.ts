/**
 * Refuter R2 (2026-09-27): the history editor capped reps at 100 while the
 * workout (field, store, draft validator) allowed 1000, so a log with a
 * 120-rep set could not be saved at all. The cap is now the shared
 * MAX_SET_REPS, and a stored count the user did not change never blocks a save.
 */
import { describe, expect, it } from 'vitest';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { MAX_SET_REPS } from '@/lib/constants';
import { MAX_REPS as DRAFT_MAX_REPS } from '@/stores/draft-validation';
import { MAX_REPS, fromLog, hasErrors, toPatch, validate } from '../edit-model';

const NOW = new Date(2026, 8, 16, 18, 0, 0);
const TODAY = '2026-09-16';

function logWith(reps: number) {
  return buildWorkoutLog('p1', { daysAgo: 1, exercises: [{ exerciseId: 'burpee', sets: [{ kg: 0, reps }] }] }, NOW, sequentialIds('r'));
}

describe('history editor reps cap', () => {
  it('is the workout cap (one shared constant)', () => {
    expect(MAX_REPS).toBe(MAX_SET_REPS);
    expect(DRAFT_MAX_REPS).toBe(MAX_SET_REPS);
    expect(MAX_SET_REPS).toBe(1000);
  });

  it('a 120-rep set logged in the workout can be edited and saved', () => {
    const draft = fromLog(logWith(120), 'kg');
    expect(hasErrors(validate(draft, 'kg', TODAY))).toBe(false);
    draft.notes = 'edited';
    expect(hasErrors(validate(draft, 'kg', TODAY))).toBe(false);
    expect(toPatch(draft, 'kg').exercises[0].sets[0].reps).toBe(120);
  });

  it('typing a count above the cap is an error; the cap itself is fine', () => {
    const draft = fromLog(logWith(10), 'kg');
    const set = draft.exercises[0].sets[0];
    set.reps = String(MAX_SET_REPS);
    expect(hasErrors(validate(draft, 'kg', TODAY))).toBe(false);
    set.reps = String(MAX_SET_REPS + 1);
    expect(validate(draft, 'kg', TODAY).sets[set.id]).toEqual({ reps: true });
  });

  it('an untouched stored count above the cap (an import) does not block the save; changing it to another too-high count does', () => {
    const draft = fromLog(logWith(1500), 'kg');
    const set = draft.exercises[0].sets[0];
    expect(set.reps).toBe('1500');
    expect(hasErrors(validate(draft, 'kg', TODAY))).toBe(false);
    set.reps = '1501';
    expect(validate(draft, 'kg', TODAY).sets[set.id]).toEqual({ reps: true });
  });
});
