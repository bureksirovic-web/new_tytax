import { describe, expect, it } from 'vitest';
import catalog from '@/data/tytax/exercises.json';
import { TYTAX_BALANCED_6DAY, TYTAX_ELITE_V3 } from '@/data/tytax/presets';
import type { Exercise, ProgramTemplate } from '@/contracts/domain';

// Recovery and balance rules for the curated 6-day TYTAX programs (2026-09-27).
// Fractional set counting: the exercise's top-scored muscle gets 1 set; any other muscle scored >= 50 gets 0.5.
// Example (hand-derived): Smith Flat Bench Press (Chest 95, Triceps 65, Front Delts 35) x 4 sets
//   -> Chest 4, Triceps 2, Front Delts 0.
const byId = new Map((catalog as Exercise[]).map((e) => [e.id, e]));

function fractional(e: Exercise): Record<string, number> {
  const top = Math.max(...e.impact.map((i) => i.score));
  const out: Record<string, number> = {};
  for (const i of e.impact) out[i.muscle] = i.score === top ? 1 : i.score >= 50 ? 0.5 : 0;
  return out;
}

function days(p: ProgramTemplate) {
  return p.sessionOrder.map((name) => {
    const s = p.sessions.find((x) => x.name === name)!;
    const m: Record<string, number> = {};
    let sets = 0;
    let axial = 0;
    for (const x of s.exercises) {
      const e = byId.get(x.exerciseId)!;
      sets += x.sets;
      for (const [k, v] of Object.entries(fractional(e))) m[k] = (m[k] ?? 0) + v * x.sets;
      if (e.impact.some((i) => i.muscle === 'Spinal Erectors' && i.score >= 40)) axial += 1;
    }
    return { name, m, sets, axial, isRest: !!s.isRest };
  });
}

const MAJOR = ['Chest', 'Lats', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

describe.each([
  ['balanced', TYTAX_BALANCED_6DAY, 18],
  ['elite v3.1', TYTAX_ELITE_V3, 20],
] as const)('TYTAX %s program: recovery balance', (_label, program, maxSets) => {
  const d = days(program);

  it('uses only curated catalog exercises (hand-scored impact), all resolvable', () => {
    for (const s of program.sessions) for (const x of s.exercises) {
      expect(byId.has(x.exerciseId), x.exerciseId).toBe(true);
      expect(x.exerciseId.startsWith('tytax_tytax_'), x.exerciseId).toBe(false);
    }
  });

  it('trains 6 days and ends the week with one rest day', () => {
    expect(d.filter((x) => !x.isRest)).toHaveLength(6);
    expect(d.at(-1)?.isRest).toBe(true);
  });

  it(`keeps every session at or under ${maxSets} working sets`, () => {
    for (const x of d) expect(x.sets, x.name).toBeLessThanOrEqual(maxSets);
  });

  it('never loads the same muscle with 3+ fractional sets on consecutive days (week wraps)', () => {
    for (let i = 0; i < d.length; i++) {
      const a = d[i];
      const b = d[(i + 1) % d.length];
      const both = Object.keys(a.m).filter((k) => (a.m[k] ?? 0) >= 3 && (b.m[k] ?? 0) >= 3);
      expect(both, `${a.name} -> ${b.name}`).toEqual([]);
    }
  });

  it('puts every major muscle in a 6-18 fractional-set weekly range', () => {
    for (const mu of MAJOR) {
      const total = d.reduce((acc, x) => acc + (x.m[mu] ?? 0), 0);
      expect(total, mu).toBeGreaterThanOrEqual(6);
      expect(total, mu).toBeLessThanOrEqual(18);
    }
  });

  it('has at most one heavy spinal-loading lift per session and two per week', () => {
    for (const x of d) expect(x.axial, x.name).toBeLessThanOrEqual(1);
    expect(d.reduce((acc, x) => acc + x.axial, 0)).toBeLessThanOrEqual(2);
  });
});
