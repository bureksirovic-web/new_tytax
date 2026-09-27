import { describe, it, expect } from 'vitest';
import type { PRCandidate } from '@/contracts/training';
import { celebratedPRs } from '../use-pr';

function pr(exerciseId: string, prType: PRCandidate['prType'], isBaseline = false): PRCandidate {
  return {
    exerciseId, exerciseName: exerciseId, prType, value: 1, kg: 1, reps: 1, setId: `${exerciseId}-${prType}`,
    sessionExerciseUid: exerciseId, previousBest: isBaseline ? null : 0.5, isBaseline,
  };
}

describe('celebratedPRs', () => {
  it('handles a missing or empty list', () => {
    expect(celebratedPRs(undefined)).toEqual([]);
    expect(celebratedPRs([])).toEqual([]);
  });

  it('drops baselines (first-ever records are never celebrated)', () => {
    expect(celebratedPRs([pr('bench', 'e1rm', true), pr('bench', 'weight', true)])).toEqual([]);
    expect(celebratedPRs([pr('bench', 'e1rm', true), pr('row', 'weight')]).map((p) => p.setId)).toEqual(['row-weight']);
  });

  it('keeps session order per exercise and orders types e1rm, weight, reps, volume', () => {
    const out = celebratedPRs([pr('row', 'volume'), pr('bench', 'weight'), pr('row', 'e1rm'), pr('bench', 'e1rm'), pr('row', 'reps')]);
    expect(out.map((p) => p.setId)).toEqual(['row-e1rm', 'row-reps', 'row-volume', 'bench-e1rm', 'bench-weight']);
  });
});
