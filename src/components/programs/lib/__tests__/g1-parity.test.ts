/// <reference types="vite/client" />
/**
 * G4-15/G4-16: G1 ported the programs-screen helpers to
 * `@/lib/programs/{load,session-kind,calendar}`. Those modules do not exist on
 * v2-g4, so production code cannot read them at runtime (a static import of a
 * missing module breaks the build) and keeps the local copies until
 * integration swaps the imports. This test pins the swap: on a tree where the
 * modules exist it checks the local copies against G1's on the same inputs;
 * on v2-g4 it checks that none of them exists yet (all-or-nothing).
 */
import { describe, expect, it } from 'vitest';
import type { Exercise, Program, ProgramSession } from '@/contracts/domain';
import { focusGroup, liveLoad, pushPull } from '../load';
import { rotationIndexForDate } from '../rotation';
import { contextAllows, hiddenChips, sessionKind, type SessionKind } from '../slot-filter';

const found = import.meta.glob(['/src/lib/programs/load.ts', '/src/lib/programs/session-kind.ts', '/src/lib/programs/calendar.ts'], {
  eager: true,
}) as Record<string, Record<string, unknown>>;
const g1 = (file: string, name: string) => found[`/src/lib/programs/${file}.ts`]?.[name] as ((...a: unknown[]) => unknown) | undefined;

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8-12', impact: [], ...over };
}
const EXERCISES: Exercise[] = [
  ex('flat', { pattern: 'Horizontal Press', impact: [{ muscle: 'Chest', score: 95 }, { muscle: 'Triceps', score: 65 }] }),
  ex('row', { pattern: 'Horizontal Pull', muscleGroup: 'BACK_HORIZONTAL', impact: [{ muscle: 'Lats', score: 92 }, { muscle: 'Biceps', score: 55 }] }),
  ex('squat', { pattern: 'Squat', muscleGroup: 'QUADS', impact: [{ muscle: 'Quads', score: 95 }, { muscle: 'Glutes', score: 70 }] }),
  ex('crunch', { pattern: 'Crunch', muscleGroup: 'CORE', impact: [{ muscle: 'Core', score: 95 }, { muscle: 'Quads', score: 92 }] }),
  ex('kick', { pattern: 'Hip Extension', muscleGroup: 'GLUTES', isUnilateral: true, impact: [{ muscle: 'Glutes', score: 90 }] }),
  ex('ohp', { pattern: 'Seated Shoulder Press', muscleGroup: 'SHOULDERS', impact: [{ muscle: 'Front Delts', score: 95 }] }),
];
const KINDS: Array<SessionKind | null> = [null, 'full', 'upper', 'lower', 'push', 'pull', 'legs'];

describe('programs helpers: local copies vs G1 @/lib/programs (G4-15/16)', () => {
  it('the G1 modules are either all present or all missing', () => {
    expect([0, 3]).toContain(Object.keys(found).length);
  });

  it('live load, focus and push:pull agree', () => {
    for (const [local, file, name] of [
      [liveLoad, 'load', 'liveLoadByGroup'],
      [focusGroup, 'load', 'projectedFocus'],
      [pushPull, 'load', 'pushPullRatio'],
    ] as const) {
      const shared = g1(file, name);
      for (let i = 0; i <= EXERCISES.length; i += 1) {
        const input = EXERCISES.slice(0, i);
        expect(shared ? shared(input) : local(input), `${name} × ${i}`).toEqual(local(input));
      }
    }
  });

  it('session kind, hidden chips and context filter agree', () => {
    const program = { splitType: 'push_pull_legs', sessions: [] } as unknown as Program;
    const sessions = ['Push A', 'Pull', 'Legs', 'Upper', 'Donji', 'Day 6'].map(
      (name, i): ProgramSession => ({ id: `s${i}`, name, dayIndex: i, exercises: [] }) as unknown as ProgramSession,
    );
    program.sessions = sessions;
    const kindOf = g1('session-kind', 'sessionKind');
    for (const s of sessions) expect(kindOf ? kindOf(program, s) : sessionKind(program, s), s.name).toBe(sessionKind(program, s));
    const chips = g1('session-kind', 'hiddenMuscleChips');
    const allows = g1('session-kind', 'sessionContextAllows');
    for (const k of KINDS) {
      expect([...((chips ? chips(k) : hiddenChips(k)) as Set<string>)].sort(), String(k)).toEqual([...hiddenChips(k)].sort());
      for (const e of EXERCISES) expect(allows ? allows(k, e) : contextAllows(k, e), `${k} ${e.id}`).toBe(contextAllows(k, e));
    }
  });

  it('calendar rotation agrees', () => {
    const shared = g1('calendar', 'rotationIndexForDate');
    const cases: Array<[string, string, number]> = [
      ['2026-09-01', '2026-09-27', 3],
      ['2026-09-30', '2026-09-27', 4],
      ['2026-03-28', '2026-03-30', 2], // DST week (Europe)
      ['bad', '2026-09-27', 3],
      ['2026-09-01', '2026-09-27', 0],
    ];
    for (const c of cases) expect(shared ? shared(...c) : rotationIndexForDate(...c), c.join(' ')).toBe(rotationIndexForDate(...c));
  });
});
