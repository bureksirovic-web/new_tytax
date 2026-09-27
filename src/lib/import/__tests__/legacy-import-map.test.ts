import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts';
import { createFallbackResolver, mapLegacyUser, parseLegacyBackup, UUID_V5_RE, type LegacyUserData, type MapContext } from '..';
import { ALL_FIXTURES, MULTI_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';

/** Synthetic catalog slice: bench by legacyName, squat and row by name (prefix stripped). */
function ex(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id, name, modality: 'tytax', muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false,
    defaultSets: 3, defaultReps: '8-12', impact: [{ muscle: 'Chest', score: 90 }], ...extra,
  };
}
const SYNTHETIC_EXERCISES: readonly Exercise[] = [
  ex('t-bench', 'Flat Bench (Smith)', { legacyName: 'TYTAX T1 | Smith Flat Bench Press', defaultSets: 4, defaultReps: '6-10' }),
  ex('t-squat', 'Smith Back Squat', { muscleGroup: 'QUADS' }),
  ex('t-row', 'Lower Pulley Seated Cable Row (bench)', { muscleGroup: 'BACK_HORIZONTAL' }),
];
const resolver = createFallbackResolver(SYNTHETIC_EXERCISES);
const IMPORTED_AT = '2026-09-26T00:00:00.000Z';

function users(file: string): LegacyUserData[] {
  return parseLegacyBackup(loadFixtureText(file)).users;
}
function ctx(profileId = 'profile-1', extra: Partial<MapContext> = {}): MapContext {
  return { profileId, resolver, importedAt: IMPORTED_AT, ...extra };
}
function ana(): LegacyUserData {
  const u = users(MULTI_USER_DUMP.file).find((x) => x.username === 'Ana');
  if (!u) throw new Error('missing Ana');
  return u;
}
function allIds(m: ReturnType<typeof mapLegacyUser>): string[] {
  return [
    ...m.logs.flatMap((l) => [l.id, ...l.exercises.flatMap((e) => [e.uid, ...e.sets.map((s) => s.id)])]),
    ...m.bodyweight.map((b) => b.id),
    ...m.programs.flatMap((p) => [p.id, ...p.sessions.map((s) => s.id)]),
  ];
}

describe('legacy-import-map: fixture counts', () => {
  it.each(ALL_FIXTURES)('$file maps every user with exact counts', (fx) => {
    for (const u of users(fx.file)) {
      const exp = fx.users[u.username];
      const m = mapLegacyUser(u, ctx());
      const sets = m.logs.flatMap((l) => l.exercises.flatMap((e) => e.sets));
      expect(m.logs).toHaveLength(exp.logs);
      expect(m.logs.flatMap((l) => l.exercises)).toHaveLength(exp.exercises);
      expect(sets).toHaveLength(exp.sets);
      expect(sets.filter((s) => s.type === 'warmup')).toHaveLength(exp.warmupSets);
      expect(m.bodyweight).toHaveLength(exp.bodyweight);
      expect(m.programs).toHaveLength(1 + exp.customProtocols);
      expect(m.programs[0].sessions).toHaveLength(exp.sessionOrder);
      expect(m.activeProgramId).toBe(m.programs[0].id);
      expect(m.programs.every((p) => p.currentSessionIndex === 0 && p.profileId === 'profile-1')).toBe(true);
      for (const log of m.logs) {
        expect(log.prCount).toBe(0);
        expect(log.createdAt).toBe(IMPORTED_AT);
        expect(log.updatedAt).toBe(IMPORTED_AT);
        expect(Date.parse(log.finishedAt) - Date.parse(log.startedAt)).toBe(log.durationSeconds * 1000);
      }
    }
  });
});

describe('legacy-import-map: determinism and ids', () => {
  it.each(ALL_FIXTURES)('$file maps deep-equal twice with unique uuid v5 ids', (fx) => {
    for (const u of users(fx.file)) {
      const a = mapLegacyUser(u, ctx());
      const b = mapLegacyUser(structuredClone(u), ctx());
      expect(b).toEqual(a);
      const ids = allIds(a);
      expect(ids.every((id) => UUID_V5_RE.test(id))).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('another profile gets disjoint ids', () => {
    const a = allIds(mapLegacyUser(ana(), ctx('profile-1')));
    const b = new Set(allIds(mapLegacyUser(ana(), ctx('profile-2'))));
    expect(a.some((id) => b.has(id))).toBe(false);
  });

  it('a duplicated exercise in one log keeps distinct uids', () => {
    const lower = mapLegacyUser(ana(), ctx()).logs[1];
    const squats = lower.exercises.filter((e) => e.exerciseId === 't-squat');
    expect(squats).toHaveLength(2);
    expect(squats[0].uid).not.toBe(squats[1].uid);
  });
});

describe('legacy-import-map: log fields and totals', () => {
  it('Ana Upper A 2025-01-01: hand-derived totals', () => {
    // Bench: warm-up 40x10 excluded; 60x8 + 60x8 working; blank undone row dropped by the parser.
    // Row: 50.5x10 working (legacy "50,5"). Volume = 480 + 480 + 505 = 1465; sets = 3.
    const log = mapLegacyUser(ana(), ctx()).logs[0];
    expect(log.totalVolumeKg).toBe(1465);
    expect(log.totalSets).toBe(3);
    expect(log).toMatchObject({
      date: '2025-01-01', sessionName: 'Upper A', durationSeconds: 3600, rpe: 8, notes: 'Good session',
      startedAt: '2025-01-01T11:00:00.000Z', finishedAt: '2025-01-01T12:00:00.000Z', modalitiesUsed: ['tytax'],
    });
    expect(log.exercises.map((e) => e.exerciseName)).toEqual(['Flat Bench (Smith)', 'Lower Pulley Seated Cable Row (bench)']);
    expect(log.exercises[0].muscleImpactSnapshot).toEqual([{ muscle: 'Chest', score: 90 }]);
    expect(log.exercises[0].sets[1]).toMatchObject({ kg: 60, reps: 8, rir: 2, done: true, type: 'working' });
    expect(log.exercises[0].sets[0].rir).toBeUndefined();
  });

  it('Ana Lower A: a done blank set counts as a set with 0 volume; unresolved is custom', () => {
    // 80x5 + 70x8 (RDL, unresolved) + 70x10 + 0x0 (done, blank) = 400 + 560 + 700 = 1660, 4 sets.
    const log = mapLegacyUser(ana(), ctx()).logs[1];
    expect(log.totalVolumeKg).toBe(1660);
    expect(log.totalSets).toBe(4);
    expect(log.modalitiesUsed).toEqual(['custom', 'tytax']);
    const rdl = log.exercises[1];
    expect(rdl).toMatchObject({ exerciseId: 'legacy:tytax-t1-smith-romanian-deadlift-rdl-60a081e9', modality: 'custom', exerciseName: 'TYTAX T1 | Smith Romanian Deadlift (RDL)' });
    expect(rdl.muscleImpactSnapshot).toBeUndefined();
  });

  it('Ana deload log with an ISO date and no duration', () => {
    const log = mapLegacyUser(ana(), ctx()).logs[2];
    expect(log).toMatchObject({ isDeload: true, startedAt: '2025-01-05T17:30:00.000Z', finishedAt: '2025-01-05T17:30:00.000Z', totalVolumeKg: 300, totalSets: 1 });
    expect(log.notes).toBeUndefined();
  });

  it('lists unresolved names with occurrences across logs and programs', () => {
    expect(mapLegacyUser(ana(), ctx()).unresolved).toEqual([
      { legacyName: 'TYTAX T1 | Smith Romanian Deadlift (RDL)', occurrences: 2 },
      { legacyName: 'TYTAX T1 | Smith Seated Shoulder Press', occurrences: 2 },
    ]);
  });
});

describe('legacy-import-map: programs and settings', () => {
  it('maps the plan (active) and the protocol (inactive)', () => {
    const m = mapLegacyUser(ana(), ctx('p', { planName: 'Imported plan' }));
    const [plan, protocol] = m.programs;
    expect(plan).toMatchObject({ name: 'Imported plan', splitType: 'custom', frequency: 2, periodizationType: 'none', isPreset: false, rotationStartDate: '2025-01-01', sessionOrder: ['Upper A', 'Lower A', 'Rest Day'], modalitiesUsed: ['custom', 'tytax'] });
    expect(plan.sessions.map((s) => [s.name, s.dayIndex, s.isRest ?? false, s.exercises.length])).toEqual([
      ['Upper A', 0, false, 3], ['Lower A', 1, false, 2], ['Rest Day', 2, true, 0],
    ]);
    expect(plan.sessions.every((s) => s.programId === plan.id)).toBe(true);
    expect(plan.sessions[0].exercises[0]).toEqual({ exerciseId: 't-bench', exerciseName: 'Flat Bench (Smith)', modality: 'tytax', sets: 4, reps: '6-10' });
    expect(plan.sessions[0].exercises[2]).toMatchObject({ modality: 'custom', sets: 3, reps: '8-12' });
    expect(protocol).toMatchObject({ name: 'Ana Full Body', frequency: 1, sessionOrder: ['Full A', 'Rest Day'] });
    expect(protocol.rotationStartDate).toBeUndefined();
    expect(m.activeProgramId).toBe(plan.id);
  });

  it('maps settings: only present keys; shared values fill gaps', () => {
    expect(mapLegacyUser(ana(), ctx()).settings).toEqual({ warmupStrategy: 'heavy', theme: 'oled', language: 'hr', barWeightKg: 20 });
    const bundle = parseLegacyBackup(loadFixtureText(MULTI_USER_DUMP.file));
    const marko = bundle.users[1];
    expect(mapLegacyUser(marko, ctx()).settings).toEqual({ warmupStrategy: 'standard', language: 'en' });
    expect(mapLegacyUser(marko, ctx('p', { sharedSettings: bundle.shared.settings })).settings).toEqual({ warmupStrategy: 'standard', language: 'en', barWeightKg: 15 });
  });
});
