import { describe, expect, it } from 'vitest';
import type { Program, ProgramSession } from '@/contracts/domain';
import { buildBuilderTemplate, slotNames, splitOptions } from '../builder';
import {
  addRestDay,
  addTrainingDay,
  daysBetweenLocal,
  isIncomplete,
  moveSession,
  programProgress,
  removeRestDay,
  removeTrainingDay,
  rotationIndexForDate,
  todayLocal,
} from '../rotation';
import { sequentialIds } from '@/contracts/fixtures';

describe('builder', () => {
  it('names slots with a letter suffix per round (legacy P7)', () => {
    // PPL×5 → i%3 pattern, letter 65+floor(i/3)
    expect(slotNames('push_pull_legs', 5)).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B']);
    expect(slotNames('upper_lower', 3)).toEqual(['Upper A', 'Lower A', 'Upper B']);
    expect(slotNames('full_body', 2)).toEqual(['Full Body A', 'Full Body B']);
    // Suffix even when days == pattern length (legacy differs from N here).
    expect(slotNames('push_pull_legs', 3)).toEqual(['Push A', 'Pull A', 'Legs A']);
  });

  it('recommends splits per legacy rule and lists the third as other', () => {
    expect(splitOptions(6).map((o) => [o.split, o.recommended])).toEqual([
      ['push_pull_legs', true],
      ['upper_lower', true],
      ['full_body', false],
    ]);
    expect(splitOptions(4).map((o) => o.split)).toEqual(['upper_lower', 'push_pull_legs', 'full_body']);
    expect(splitOptions(2).map((o) => o.split)).toEqual(['full_body', 'upper_lower', 'push_pull_legs']);
  });

  it('builds a template with training days, a trailing rest day and a start date', () => {
    const tpl = buildBuilderTemplate({ days: 4, split: 'upper_lower', name: ' 4-day UL ', restDayName: 'Rest day', today: '2026-09-26', newId: sequentialIds('s') });
    expect(tpl.name).toBe('4-day UL');
    expect(tpl.sessions.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Rest day']);
    expect(tpl.sessions.map((s) => s.isRest)).toEqual([false, false, false, false, true]);
    expect(tpl.sessions.map((s) => s.dayIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(tpl.sessionOrder).toEqual(tpl.sessions.map((s) => s.name));
    expect(tpl).toMatchObject({ splitType: 'upper_lower', frequency: 4, isPreset: false, currentSessionIndex: 0, rotationStartDate: '2026-09-26', modalitiesUsed: ['tytax'] });
    expect(new Set(tpl.sessions.map((s) => s.id)).size).toBe(5);
  });
});

function session(id: string, isRest = false, exercises = 0): ProgramSession {
  return {
    id,
    programId: 'p',
    name: id,
    dayIndex: 0,
    isRest,
    exercises: Array.from({ length: exercises }, (_, i) => ({ exerciseId: `e${i}`, exerciseName: `E${i}`, modality: 'tytax' as const, sets: 3, reps: '8' })),
  };
}

function prog(sessions: ProgramSession[], currentSessionIndex = 0): Pick<Program, 'sessions' | 'currentSessionIndex'> {
  return { sessions, currentSessionIndex };
}

describe('rotation', () => {
  it('counts local days and wraps the calendar formula (spec hand-checks)', () => {
    expect(daysBetweenLocal('2026-09-20', '2026-09-26')).toBe(6);
    // start 20th, today 26th, 7 sessions → 6 → the 7th (Rest)
    expect(rotationIndexForDate('2026-09-20', '2026-09-26', 7)).toBe(6);
    // start in the future: diff −2 → ((−2 % 7) + 7) % 7 = 5 → Lower C
    expect(rotationIndexForDate('2026-09-28', '2026-09-26', 7)).toBe(5);
    // across the CET DST change (25 Oct 2026): still whole days
    expect(daysBetweenLocal('2026-10-24', '2026-10-26')).toBe(2);
    expect(rotationIndexForDate('bad', '2026-09-26', 7)).toBeNull();
    expect(rotationIndexForDate('2026-09-20', '2026-09-26', 0)).toBeNull();
  });

  it('formats today as the local day', () => {
    expect(todayLocal(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
  });

  it('moves a session and keeps the pointer on the same session id', () => {
    const p = prog([session('a'), session('b'), session('c')], 1); // pointer on b
    const moved = moveSession(p, 1, 0);
    expect(moved.sessions.map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(moved.currentSessionIndex).toBe(0);
    expect(moved.sessions.map((s) => s.dayIndex)).toEqual([0, 1, 2]);
    expect(moved.sessionOrder).toEqual(['b', 'a', 'c']);
    const other = moveSession(p, 2, 0); // c to front, b shifts to 2
    expect(other.currentSessionIndex).toBe(2);
  });

  it('adds and removes rest days; removing the pointed rest moves the pointer to its successor', () => {
    const p = prog([session('a'), session('r', true), session('b')], 1);
    const added = addRestDay(p, 'Rest', () => 'r2');
    expect(added.sessions.map((s) => s.id)).toEqual(['a', 'r', 'b', 'r2']);
    expect(added.sessions[3].isRest).toBe(true);
    expect(added.currentSessionIndex).toBe(1);
    const removed = removeRestDay(p, 1);
    expect(removed.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(removed.currentSessionIndex).toBe(1); // b took index 1
    // Training days are never removed here.
    expect(removeRestDay(p, 0).sessions).toHaveLength(3);
  });

  it('adds a training day before trailing rest days and removes training days; frequency follows', () => {
    const p = prog([session('a'), session('b'), session('r', true)], 2); // pointer on rest
    const added = addTrainingDay(p, 'Day 3', () => 'c');
    expect(added.sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'r']);
    expect(added.sessions[2]).toMatchObject({ name: 'Day 3', isRest: false, exercises: [], dayIndex: 2 });
    expect(added.currentSessionIndex).toBe(3); // still the rest day
    expect(added.frequency).toBe(3);

    const q = prog([session('a'), session('b'), session('r', true)], 0); // pointer on a
    const removed = removeTrainingDay(q, 0);
    expect(removed.sessions.map((s) => s.id)).toEqual(['b', 'r']);
    expect(removed.currentSessionIndex).toBe(0); // b took a's place
    expect(removed.frequency).toBe(1);
    // the pointer follows its session when another day is removed
    expect(removeTrainingDay(prog([session('a'), session('b'), session('r', true)], 2), 0).currentSessionIndex).toBe(1);
    // rest days and the last training day are not removed here
    expect(removeTrainingDay(q, 2).sessions).toHaveLength(3);
    expect(removeTrainingDay(prog([session('a'), session('r', true)], 0), 0).sessions).toHaveLength(2);
  });

  it('reports progress and incompleteness over training days only', () => {
    const p = { sessions: [session('a', false, 2), session('b', false, 0), session('r', true)] };
    expect(programProgress(p)).toEqual({ filled: 1, total: 2 });
    expect(isIncomplete(p)).toBe(true);
    expect(isIncomplete({ sessions: [session('a', false, 1), session('r', true)] })).toBe(false);
    expect(isIncomplete({ sessions: [session('r', true)] })).toBe(true);
  });
});
