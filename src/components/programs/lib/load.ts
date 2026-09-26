/**
 * Live load, focus and push:pull for a set of exercises (legacy slot editor).
 * Local adapter until G1 ships projectedImpact/liveLoadByGroup/pushPullRatio
 * (request docs/v2/requests/G4-16-program-training-helpers.md).
 */
import type { Exercise } from '@/contracts/domain';

export type LoadGroup = 'CHEST' | 'BACK' | 'SHOULDERS' | 'BICEPS' | 'TRICEPS' | 'QUADS' | 'HAMSTRINGS' | 'GLUTES' | 'CALVES' | 'CORE';

export const LOAD_GROUPS: readonly LoadGroup[] = ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'CORE'];

/** Scores at or above this fill a bar (legacy caps the visual at 300 points). */
export const LOAD_CAP = 300;

/**
 * Muscle → group rules of legacy L4664-4673, case-insensitive (catalog names
 * are mixed case: "Lats" and "lats"). One muscle may feed two groups
 * ("Spinal Erectors" is Back and Core), exactly as legacy.
 */
export function muscleInGroup(muscle: string, group: LoadGroup): boolean {
  const m = muscle.trim().toLowerCase();
  switch (group) {
    case 'CHEST':
      return m.includes('chest');
    case 'BACK':
      return m === 'lats' || m === 'mid back' || m.includes('trap') || m.includes('rhomboid') || m.includes('erector') || m.includes('back');
    case 'SHOULDERS':
      return m.includes('delt') || m.includes('rotator') || m.includes('supraspinatus') || m === 'shoulders';
    case 'BICEPS':
      return m === 'biceps' || m.includes('brach');
    case 'TRICEPS':
      return m === 'triceps';
    case 'QUADS':
      return m === 'quads';
    case 'HAMSTRINGS':
      return m === 'hamstrings';
    case 'GLUTES':
      return m.includes('glute');
    case 'CALVES':
      return m === 'calves' || m === 'gastrocnemius' || m === 'soleus';
    case 'CORE':
      return m === 'abs' || m === 'obliques' || m === 'core' || m === 'lower back' || m === 'spinal erectors' || m === 'serratus';
  }
}

export interface GroupLoad {
  group: LoadGroup;
  score: number;
  /** min(100, score / 300 × 100). */
  pct: number;
}

/** Σ over exercises of Σ matching impact scores × (unilateral ? 2 : 1). */
export function liveLoad(exercises: readonly Exercise[]): GroupLoad[] {
  return LOAD_GROUPS.map((group) => {
    let score = 0;
    for (const ex of exercises) {
      const s = ex.impact.reduce((acc, i) => (muscleInGroup(i.muscle, group) ? acc + i.score : acc), 0);
      score += s * (ex.isUnilateral ? 2 : 1);
    }
    return { group, score, pct: Math.min(100, (score / LOAD_CAP) * 100) };
  });
}

/** The group with the highest load, or null when nothing loads any group. Ties keep LOAD_GROUPS order. */
export function focusGroup(exercises: readonly Exercise[]): LoadGroup | null {
  let best: GroupLoad | null = null;
  for (const g of liveLoad(exercises)) if (g.score > 0 && (!best || g.score > best.score)) best = g;
  return best?.group ?? null;
}

export interface PushPull {
  push: number;
  pull: number;
  /** pull === 0 ? push : push / pull (legacy L4429-4444). */
  ratio: number;
  imbalanced: boolean;
}

/** One exercise may count as both push and pull (e.g. "Squat Row"). */
export function pushPull(exercises: readonly Exercise[]): PushPull {
  let push = 0;
  let pull = 0;
  for (const ex of exercises) {
    const p = (ex.pattern || '').toLowerCase();
    if (p.includes('press') || p.includes('squat') || p.includes('extension') || p.includes('push')) push++;
    if (p.includes('pull') || p.includes('row') || p.includes('curl') || p.includes('deadlift')) pull++;
  }
  const ratio = pull === 0 ? push : push / pull;
  return { push, pull, ratio, imbalanced: ratio > 2 };
}
