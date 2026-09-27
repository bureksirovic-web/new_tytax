/** Mapper must not merge distinct exercises or drop plan content silently (refuter findings, 2026-09-26). */
import { describe, expect, it } from 'vitest';
import { createFallbackResolver, customExerciseId, mapLegacyUser, type LegacyLog, type LegacyUserData, type MapContext } from '..';

const ctx: MapContext = { profileId: 'p1', resolver: createFallbackResolver([]), importedAt: '2026-09-26T00:00:00.000Z' };
const set = { kg: 50, reps: 5, done: true, type: 'working' as const };

function user(extra: Partial<LegacyUserData>): LegacyUserData {
  return { username: 'u', logs: [], trainingPlan: {}, sessionOrder: [], bodyweight: [], customProtocols: [], settings: {}, ...extra };
}
function logWith(...names: string[]): LegacyLog {
  return { sourceId: '1', date: '2024-01-01', sessionName: 'A', durationSeconds: 60, exercises: names.map((legacyName) => ({ legacyName, sets: [set] })) };
}

describe('legacy-import-map: custom exercise ids are injective', () => {
  it('gives distinct non-Latin names distinct ids (slug alone folds both to "unnamed")', () => {
    const m = mapLegacyUser(user({ logs: [logWith('Жим лёжа', 'Присед')] }), ctx);
    expect(m.unresolved.map((u) => u.legacyName)).toEqual(['Жим лёжа', 'Присед']);
    expect(m.logs[0].exercises.map((e) => e.exerciseId)).toEqual(['legacy:unnamed-2ab7c7b8', 'legacy:unnamed-d136a651']);
  });

  it('gives Latin names with the same slug distinct ids', () => {
    const m = mapLegacyUser(user({ logs: [logWith('Row 1/2', 'Row 1-2')] }), ctx);
    expect(m.unresolved).toHaveLength(2);
    expect(m.logs[0].exercises.map((e) => e.exerciseId)).toEqual(['legacy:row-1-2-602a0570', 'legacy:row-1-2-6f615e19']);
  });

  it('is deterministic and case/whitespace-insensitive, so re-import and spelling variants agree', () => {
    expect(customExerciseId('Row 1/2')).toBe(customExerciseId('  row   1/2 '));
    const a = mapLegacyUser(user({ logs: [logWith('Присед')], trainingPlan: { A: ['присед'] }, sessionOrder: ['A'] }), ctx);
    const b = mapLegacyUser(user({ logs: [logWith('Присед')], trainingPlan: { A: ['присед'] }, sessionOrder: ['A'] }), ctx);
    expect(a.logs[0].exercises[0].exerciseId).toBe(a.programs[0].sessions[0].exercises[0].exerciseId);
    expect(a.logs[0].exercises[0].exerciseId).toBe(b.logs[0].exercises[0].exerciseId);
  });
});

describe('legacy-import-map: plan content is never dropped silently', () => {
  it('warns PLAN_SESSION_UNUSED for each plan session sessionOrder does not list', () => {
    const m = mapLegacyUser(user({ trainingPlan: { A: ['Squat'], B: ['Bench'], C: [] }, sessionOrder: ['A'] }), ctx);
    expect(m.programs[0].sessions.map((s) => s.name)).toEqual(['A']);
    expect(m.warnings).toEqual([
      expect.objectContaining({ code: 'PLAN_SESSION_UNUSED', path: 'trainingPlan.plan.B' }),
      expect.objectContaining({ code: 'PLAN_SESSION_UNUSED', path: 'trainingPlan.plan.C' }),
    ]);
  });

  it('does not warn PLAN_SESSION_UNUSED when the rotation falls back to the plan key order', () => {
    const m = mapLegacyUser(user({ trainingPlan: { A: ['Squat'], B: ['Bench'] } }), ctx);
    expect(m.programs[0].sessions.map((s) => s.name)).toEqual(['A', 'B']);
    expect(m.warnings).toEqual([]);
  });

  it('warns PLAN_SESSION_UNUSED on custom protocols with the protocol path', () => {
    const proto = { sourceId: 'c1', name: 'P', plan: { A: ['X'], Extra: ['Y'] }, order: ['A'] };
    const m = mapLegacyUser(user({ customProtocols: [proto] }), ctx);
    expect(m.warnings).toEqual([expect.objectContaining({ code: 'PLAN_SESSION_UNUSED', path: 'customProtocols[0].plan.Extra' })]);
  });

  it('warns REST_SESSION_EXERCISES_DROPPED when a rest-named session lists exercises', () => {
    const m = mapLegacyUser(user({ trainingPlan: { Rest: ['Walk', 'Stretch'], A: ['Squat'] }, sessionOrder: ['A', 'Rest'] }), ctx);
    const rest = m.programs[0].sessions[1];
    expect(rest).toMatchObject({ name: 'Rest', isRest: true, exercises: [] });
    expect(m.warnings).toEqual([expect.objectContaining({ code: 'REST_SESSION_EXERCISES_DROPPED', path: 'trainingPlan.plan.Rest' })]);
    expect(m.warnings[0].message).toContain('2 exercise(s)');
    expect(m.unresolved.map((u) => u.legacyName)).toEqual(['Squat']);
  });

  it('does not warn for an empty rest-named session', () => {
    const m = mapLegacyUser(user({ trainingPlan: { A: ['Squat'], 'Rest Day': [] }, sessionOrder: ['A', 'Rest Day'] }), ctx);
    expect(m.warnings).toEqual([]);
  });
});
