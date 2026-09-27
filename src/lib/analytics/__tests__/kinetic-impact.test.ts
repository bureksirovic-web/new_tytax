import { describe, it, expect } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { computeKineticImpact } from '../kinetic-impact';
import { daysBefore, volumeLog } from './fixtures';

// Wednesday 2026-09-23, local noon
const NOW = new Date(2026, 8, 23, 12, 0, 0);
const lookup: ExerciseLookup = () => undefined;

function run(logs: WorkoutLog[] | null) {
  return computeKineticImpact(logs, 28, { now: NOW, lookup });
}

describe('computeKineticImpact', () => {
  it('returns 0 for empty or null logs', () => {
    for (const result of [run([]), run(null)]) {
      expect(result.score).toBe(0);
      expect(result.label).toBe('poor');
      expect(result.components).toEqual({ acwrScore: 0, parityScore: 0, consistencyScore: 0, volumeScore: 0 });
    }
  });

  it('returns 0 when every log is older than the window or soft-deleted', () => {
    const old = volumeLog(daysBefore(NOW, 40), 1000);
    const deleted = { ...volumeLog(daysBefore(NOW, 1), 1000), deletedAt: 'x' };
    expect(run([old, deleted]).score).toBe(0);
  });

  it('scores a single session today exactly', () => {
    const r = run([volumeLog(daysBefore(NOW, 0), 1000)]);
    // acwr: single day → ratio 1 → 30
    // parity: all volume 'other' (100 %); |deltas| = 20+20+20+20+5+10+95 = 190 → avg 190/7 → 30×(1 − 27.14/100) = 21.857 → 22
    // consistency: 1 session in 1 week → 1/3 × 20 = 6.67 → 7
    // volume: this week 1000 vs 4-week mean 1000/4 = 250 → ratio 4 → 20×(1 − (4 − 1.1)) < 0 → 0
    expect(r.components).toEqual({ acwrScore: 30, parityScore: 22, consistencyScore: 7, volumeScore: 0 });
    // round(30 + 21.857 + 6.667 + 0) = round(58.52) = 59 → fair (40–59)
    expect(r.score).toBe(59);
    expect(r.label).toBe('fair');
  });

  it('higher volume never lowers the score for the same schedule', () => {
    const logs1: WorkoutLog[] = [];
    const logs2: WorkoutLog[] = [];
    for (let i = 0; i < 14; i++) {
      logs1.push(volumeLog(daysBefore(NOW, i * 2), 500));
      logs2.push(volumeLog(daysBefore(NOW, i * 2), 2000));
    }
    const r1 = run(logs1);
    const r2 = run(logs2);
    expect(r2.score).toBeGreaterThanOrEqual(r1.score);
    // score is bounded to 0–100 by construction (30 + 30 + 20 + 20)
    expect(r2.score).toBeLessThanOrEqual(100);
    expect(['poor', 'fair', 'good', 'excellent']).toContain(r2.label);
  });

  it('daily training for a week gets full consistency points', () => {
    const logs = Array.from({ length: 7 }, (_, i) => volumeLog(daysBefore(NOW, i), 1000, 'Chest', 'same_ex'));
    const r = run(logs);
    // 7 sessions over 2 ISO weeks (Mon 21–Wed 23 and Thu 17–Sun 20) → 3.5/week ≥ 3 → 20
    expect(r.components.consistencyScore).toBe(20);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('returns an i18n explanation key matching the label', () => {
    // no logs → the no-data key
    expect(computeKineticImpact([], 28, { now: NOW, lookup }).explanationKey).toBe('ki_no_data');
    const r = computeKineticImpact(null, 28, { now: NOW, lookup });
    expect(r.explanationKey).toBe('ki_no_data');
    expect(r.label).toBe('poor');
  });
});
