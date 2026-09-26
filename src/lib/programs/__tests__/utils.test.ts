import { describe, it, expect } from 'vitest';
import type { Program, ProgramSession } from '@/contracts/domain';
import { getCurrentSession, isRestSession, nextSessionIndex } from '../utils';

function session(name: string, dayIndex: number, extra: Partial<ProgramSession> = {}): ProgramSession {
  return { id: `s-${name}`, programId: 'prog-1', name, dayIndex, exercises: [], ...extra };
}

function makeProgram(sessionNames: string[], currentSessionIndex: number): Program {
  return {
    id: 'prog-1',
    profileId: 'profile-1',
    name: 'Test',
    splitType: 'full_body',
    frequency: 3,
    periodizationType: 'none',
    sessionOrder: sessionNames,
    sessions: sessionNames.map((n, i) => session(n, i)),
    modalitiesUsed: ['tytax'],
    isPreset: false,
    currentSessionIndex,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('getCurrentSession', () => {
  it('returns the session the pointer names', () => {
    const current = getCurrentSession(makeProgram(['A', 'B'], 1));
    expect(current).not.toBeNull();
    expect(current?.name).toBe('B');
  });

  it('returns null for a program without sessions', () => {
    expect(getCurrentSession(makeProgram([], 0))).toBeNull();
  });

  it('returns null when the pointer is out of range', () => {
    expect(getCurrentSession(makeProgram(['A', 'B'], 2))).toBeNull();
    expect(getCurrentSession(makeProgram(['A', 'B'], -1))).toBeNull();
  });
});

describe('nextSessionIndex', () => {
  it('moves to the next session', () => {
    // (0 + 1) % 3 = 1
    expect(nextSessionIndex(makeProgram(['A', 'B', 'C'], 0))).toBe(1);
  });

  it('wraps from the last session to the first', () => {
    // (6 + 1) % 7 = 0
    expect(nextSessionIndex(makeProgram(['1', '2', '3', '4', '5', '6', '7'], 6))).toBe(0);
  });

  it('is 0 for a program without sessions', () => {
    // no sessions: nothing to rotate, the pointer stays at 0
    expect(nextSessionIndex(makeProgram([], 0))).toBe(0);
  });

  it('restarts at the first session when the pointer is invalid', () => {
    // invalid pointer treated as -1: (-1 + 1) % 2 = 0
    expect(nextSessionIndex(makeProgram(['A', 'B'], -3))).toBe(0);
  });
});

describe('isRestSession', () => {
  it('is true only for sessions marked isRest', () => {
    expect(isRestSession(session('Rest', 3, { isRest: true }))).toBe(true);
    expect(isRestSession(session('Push', 0))).toBe(false);
    expect(isRestSession(session('Pull', 1, { isRest: false }))).toBe(false);
  });
});
