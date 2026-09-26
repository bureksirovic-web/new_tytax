import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts';
import {
  createFallbackResolver, importId, mapLegacyUser, mapSettings, resolveLegacyName, sha1Hex, slug, uuidV5,
  type LegacyLog, type LegacyUserData, type MapWarning,
} from '..';

const DNS_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const AT = '2026-09-26T00:00:00.000Z';

function ex(id: string, name: string, legacyName?: string): Exercise {
  return { id, name, legacyName, modality: 'bodyweight', muscleGroup: 'CORE', pattern: 'core', isUnilateral: false, defaultSets: 2, defaultReps: '10', impact: [] };
}
function user(extra: Partial<LegacyUserData>): LegacyUserData {
  return { username: 'u', logs: [], trainingPlan: {}, sessionOrder: [], bodyweight: [], customProtocols: [], settings: {}, ...extra };
}
function log(extra: Partial<LegacyLog>): LegacyLog {
  return { sourceId: 'x1', date: '2025-03-01', sessionName: 'S', durationSeconds: 600, exercises: [], ...extra };
}
const none = { getByLegacyName: (): Exercise | undefined => undefined };
const map = (u: LegacyUserData) => mapLegacyUser(u, { profileId: 'p', resolver: none, importedAt: AT });
const codes = (w: MapWarning[]) => w.map((x) => x.code);

describe('legacy-import-map: sha1 and uuid v5', () => {
  it('matches the FIPS 180 test vectors', () => {
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('84983e441c3bd26ebaae4aa1f95129e5e54670f1');
    expect(sha1Hex('a'.repeat(1000))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
  });

  it('matches the RFC 4122 v5 reference for www.example.com in the DNS namespace', () => {
    expect(uuidV5('www.example.com', DNS_NS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('rejects a malformed namespace and separates kinds', () => {
    expect(() => uuidV5('x', 'not-a-uuid')).toThrow(/namespace/);
    expect(importId('p', 'log', '1')).not.toBe(importId('p', 'set', '1'));
  });
});

describe('legacy-import-map: resolver', () => {
  it('tries exact, prefix-stripped, then normalized names', () => {
    const table = new Map([['Exact', ex('a', 'A')], ['Plank', ex('b', 'B')], ['side plank', ex('c', 'C')]]);
    const r = { getByLegacyName: (n: string) => table.get(n) };
    expect(resolveLegacyName('Exact', r)?.id).toBe('a');
    expect(resolveLegacyName('TYTAX T1 | Plank', r)?.id).toBe('b');
    expect(resolveLegacyName('  Side   PLANK ', r)?.id).toBe('c');
    expect(resolveLegacyName('tytax t1 |   SIDE plank', r)?.id).toBe('c');
    expect(resolveLegacyName('Nope', r)).toBeUndefined();
  });

  it('fallback resolver prefers legacyName over name', () => {
    const r = createFallbackResolver([ex('by-name', 'Push Up'), ex('by-legacy', 'Other', 'push up'), ex('dup', 'Push Up')]);
    expect(r.getByLegacyName('PUSH  UP')?.id).toBe('by-legacy');
    expect(createFallbackResolver([ex('first', 'Dip'), ex('second', 'dip')]).getByLegacyName('Dip')?.id).toBe('first');
  });

  it('slugs names with diacritics and never returns empty', () => {
    expect(slug('Čučanj  s Šipkom!')).toBe('cucanj-s-sipkom');
    expect(slug('***')).toBe('unnamed');
  });
});

describe('legacy-import-map: value guards', () => {
  it('clamps RPE above 10, drops RPE below 1, clamps RIR', () => {
    const set = { kg: 10, reps: 5, done: true, type: 'working' as const };
    const m = map(user({ logs: [
      log({ sourceId: 'a', rpe: 12, exercises: [{ legacyName: 'X', sets: [{ ...set, rir: 7 }, { ...set, rir: 3 }] }] }),
      log({ sourceId: 'b', rpe: 0 }),
      log({ sourceId: 'c', rpe: 6.5 }),
    ] }));
    expect(m.logs.map((l) => l.rpe)).toEqual([10, undefined, 6.5]);
    expect(m.logs[0].exercises[0].sets.map((s) => s.rir)).toEqual([5, 3]);
    expect(codes(m.warnings).filter((c) => c !== 'START_TIME_FALLBACK')).toEqual(['RIR_CLAMPED', 'RPE_OUT_OF_RANGE', 'RPE_OUT_OF_RANGE']);
  });

  it('derives startedAt from finishedAt, else falls back to noon UTC', () => {
    const m = map(user({ logs: [
      log({ sourceId: 'a', finishedAt: '2025-03-01T10:10:00.000Z' }),
      log({ sourceId: 'b', startedAt: 'garbage' }),
    ] }));
    expect(m.logs[0].startedAt).toBe('2025-03-01T10:00:00.000Z');
    expect(m.logs[1]).toMatchObject({ startedAt: '2025-03-01T12:00:00.000Z', finishedAt: '2025-03-01T12:10:00.000Z' });
    expect(codes(m.warnings)).toEqual(['START_TIME_FALLBACK']);
  });

  it('counts drop and failure sets, never warm-ups or undone sets', () => {
    const s = (type: 'warmup' | 'working' | 'drop' | 'failure', done = true) => ({ kg: 10, reps: 2, done, type });
    const m = map(user({ logs: [log({ exercises: [{ legacyName: 'X', sets: [s('warmup'), s('working'), s('drop'), s('failure'), s('working', false)] }] })] }));
    expect(m.logs[0]).toMatchObject({ totalVolumeKg: 60, totalSets: 3, modalitiesUsed: ['custom'] });
  });

  it('bodyweight ids use date + index; non-positive values are skipped', () => {
    const m = map(user({ bodyweight: [{ date: '2025-01-01', kg: 80 }, { date: '2025-01-01', kg: 81 }, { date: '2025-01-02', kg: 0 }] }));
    expect(m.bodyweight.map((b) => b.valueKg)).toEqual([80, 81]);
    expect(m.bodyweight[0].id).toBe(importId('p', 'bodyweight', '2025-01-01|0'));
    expect(m.bodyweight[1].id).toBe(importId('p', 'bodyweight', '2025-01-01|1'));
    expect(codes(m.warnings)).toEqual(['INVALID_BODYWEIGHT']);
  });
});

describe('legacy-import-map: program edge cases', () => {
  it('no plan -> no active program; protocols stay inactive with unique ids', () => {
    const proto = { sourceId: 'c1', name: 'P', plan: { A: ['X'] }, order: [] };
    const m = map(user({ customProtocols: [proto, { ...proto, name: 'P2' }, { ...proto, plan: {}, order: [] }] }));
    expect(m.activeProgramId).toBeNull();
    expect(m.programs.map((p) => p.name)).toEqual(['P', 'P2']);
    expect(m.programs[0].id).not.toBe(m.programs[1].id);
    expect(m.programs[0].sessionOrder).toEqual(['A']);
  });

  it('a session missing from the plan becomes a rest day with a warning; empty sessions are rest', () => {
    const m = map(user({ trainingPlan: { A: ['X'], Empty: [], Odmor: ['Y'] }, sessionOrder: ['A', 'Ghost', 'Empty', 'Odmor'] }));
    const plan = m.programs[0];
    expect(plan.sessions.map((s) => s.isRest ?? false)).toEqual([false, true, true, true]);
    expect(plan.sessions[3].exercises).toEqual([]);
    expect(plan.frequency).toBe(1);
    expect(plan.name).toBe('TYTAX (uvezeno)');
    expect(m.unresolved).toEqual([{ legacyName: 'X', occurrences: 1 }]);
    expect(m.warnings).toEqual([
      expect.objectContaining({ code: 'PLAN_SESSION_MISSING', path: 'trainingPlan.order[1]' }),
      expect.objectContaining({ code: 'REST_SESSION_EXERCISES_DROPPED', path: 'trainingPlan.plan.Odmor' }),
    ]);
  });
});

describe('legacy-import-map: settings', () => {
  it('maps warm-up case-insensitively, oled false -> tactical, ignores unknown strategies', () => {
    const w: MapWarning[] = [];
    expect(mapSettings({ warmupStrategy: 'PYRAMID', oledMode: false }, undefined, w)).toEqual({ warmupStrategy: 'pyramid', theme: 'tactical' });
    expect(mapSettings({ warmupStrategy: 'Wild', language: 'en', barWeightKg: 17.5 }, { language: 'hr', barWeightKg: 15 }, w)).toEqual({ language: 'en', barWeightKg: 17.5 });
    expect(mapSettings({}, {}, w)).toEqual({});
    expect(codes(w)).toEqual(['UNKNOWN_WARMUP_STRATEGY']);
  });
});
