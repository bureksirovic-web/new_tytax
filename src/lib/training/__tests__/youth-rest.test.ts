import { describe, expect, it } from 'vitest';
import type { Program, ProgramSession } from '@/contracts/domain';
import { restDayLocked } from '../youth';

// Local-time dates so the calendar-day arithmetic is deterministic.
const at = (day: number, hour = 12) => new Date(2026, 8, day, hour, 0, 0); // Sep 2026: 21 = Mon
const youth = { birthYear: 2015 }; // 2026 - 2015 = 11
const adult = { birthYear: 1985 };
const train = (name: string): ProgramSession => ({ id: name, programId: 'p', name, dayIndex: 0, exercises: [{ exerciseId: 'x', exerciseName: 'X', modality: 'bodyweight', sets: 1, reps: '8' }] });
const rest = (name: string): ProgramSession => ({ id: name, programId: 'p', name, dayIndex: 0, exercises: [], isRest: true });
// Rotation A, Rest, B, Rest, C, Rest, Rest (the youth preset shape).
const sessions = [train('A'), rest('R1'), train('B'), rest('R2'), train('C'), rest('R3'), rest('R4')];
const prog = (currentSessionIndex: number, updatedAt: Date): Pick<Program, 'updatedAt' | 'sessions' | 'currentSessionIndex'> => ({
  sessions, currentSessionIndex, updatedAt: updatedAt.toISOString(),
});

describe('restDayLocked: a youth rest day is marked done only once it has passed', () => {
  it('after a workout: locked the same day and the next day, open two days later', () => {
    // Mon 21 workout A -> pointer on R1. Tue 22 is the rest day itself.
    expect(restDayLocked(youth, prog(1, at(21, 18)), at(21, 20))).toBe(true); // Mon: same day
    expect(restDayLocked(youth, prog(1, at(21, 18)), at(22, 9))).toBe(true); // Tue: the rest day is not over
    expect(restDayLocked(youth, prog(1, at(21, 18)), at(23, 7))).toBe(false); // Wed: done, train B today
  });
  it('after another rest day: one more calendar day', () => {
    // Fri 25 workout C -> R3; R3 completed Sun 27 -> pointer on R4, stamped Sun.
    expect(restDayLocked(youth, prog(5, at(25, 18)), at(27, 9))).toBe(false);
    expect(restDayLocked(youth, prog(6, at(27, 9)), at(27, 20))).toBe(true); // same day as R3 completion
    expect(restDayLocked(youth, prog(6, at(27, 9)), at(28, 8))).toBe(false); // Mon: second rest day passed
  });
  it('never locks an adult or a profile without a birth year', () => {
    expect(restDayLocked(adult, prog(1, at(21, 18)), at(21, 20))).toBe(false);
    expect(restDayLocked({}, prog(1, at(21, 18)), at(21, 20))).toBe(false);
  });
  it('does not lock on a missing program, empty rotation or unparseable timestamp', () => {
    expect(restDayLocked(youth, null, at(21))).toBe(false);
    expect(restDayLocked(youth, { sessions: [], currentSessionIndex: 0, updatedAt: at(21).toISOString() }, at(21))).toBe(false);
    expect(restDayLocked(youth, { sessions, currentSessionIndex: 1, updatedAt: 'not-a-date' }, at(21))).toBe(false);
  });
});
