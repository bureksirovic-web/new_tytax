import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionExercise, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { createWorkoutOrchestrator, EmptyWorkoutError } from '../workout-orchestrator';
import { useWorkoutStore } from '../workout-store';
import { HOLD_STORAGE_PREFIX } from '../hold-storage';
import { ex, fakeCatalog } from './g3-helpers';

const NOW = new Date('2026-09-20T12:00:00.000Z');
const smith = ex('smith-press', [['Chest', 100]], { stationId: 'SMITH' });
// G1's orderByStation reads catalog `stationId` only (the removed local adapter also
// normalised display names); the real catalog tags upper-pulley exercises 'BACK_UPPER'.
const lat = ex('lat-pull', [['Lats', 100]], { station: 'Back Upper Pulley', stationId: 'BACK_UPPER' });
const legCurl = ex('leg-curl', [['Hamstrings', 100]], { stationId: 'LEG_CURL' });
const plank = ex('plank', [['Abs', 90]], { defaultReps: '30-60s', modality: 'bodyweight' });
const catalog = fakeCatalog([smith, lat, legCurl, plank]);

const se = (uid: string, exerciseId: string, over: Partial<SessionExercise> = {}): SessionExercise => ({
  uid, exerciseId, exerciseName: exerciseId, modality: 'tytax', sets: [{ id: `${uid}-s`, type: 'working', kg: 50, reps: 8, done: false }], ...over,
});

let n = 0;
let repo: Repository;
let profileId: string;
const orch = () => createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog, now: () => NOW });
const store = () => useWorkoutStore.getState();
const order = () => store().draft?.exercises.map((e) => e.uid);

describe('workout orchestrator — Wave 2', () => {
  beforeEach(async () => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`orch-w2-${n}`) });
    profileId = (await repo.profiles.ensureActive('Me')).id;
    store().discard();
    localStorage.clear();
  });

  it('orderByStation reorders the draft and reports whether anything changed', async () => {
    expect(await orch().orderByStation(profileId)).toBe(false);
    store().startDraft({ profileId, sessionName: 'S', exercises: [se('a', 'leg-curl'), se('b', 'plank'), se('c', 'lat-pull'), se('d', 'smith-press')] });
    expect(await orch().orderByStation(profileId)).toBe(true);
    // SMITH d → BACK_UPPER c → LEG_CURL a → no station b.
    expect(order()).toEqual(['d', 'c', 'a', 'b']);
    expect(await orch().orderByStation(profileId)).toBe(false);
  });

  it('orderByStation leaves a foreign draft alone', async () => {
    store().startDraft({ profileId: 'other', sessionName: 'S', exercises: [se('a', 'leg-curl'), se('b', 'smith-press')] });
    expect(await orch().orderByStation(profileId)).toBe(false);
    expect(order()).toEqual(['a', 'b']);
  });

  it('orderByStation does not touch a draft replaced while the catalog loaded', async () => {
    store().startDraft({ profileId, sessionName: 'S', exercises: [se('a', 'leg-curl'), se('b', 'smith-press')] });
    const o = createWorkoutOrchestrator({
      repo,
      loadCatalog: async () => {
        store().startDraft({ profileId, sessionName: 'New', exercises: [se('x', 'leg-curl'), se('y', 'smith-press')] });
        return catalog;
      },
    });
    expect(await o.orderByStation(profileId)).toBe(false);
    expect(order()).toEqual(['x', 'y']);
  });

  it('repeatLog: refuses over a draft unless replace, refuses a foreign log, and finishes as a quick workout', async () => {
    const program = await repo.programs.create(profileId, {
      name: 'P', splitType: 'custom', frequency: 1, periodizationType: 'none', sessionOrder: [], modalitiesUsed: ['tytax'], isPreset: false, currentSessionIndex: 0,
      sessions: [
        { id: 'a', programId: '', name: 'Push', dayIndex: 0, exercises: [{ exerciseId: 'smith-press', exerciseName: 'Smith', modality: 'tytax', sets: 1, reps: '8' }] },
        { id: 'b', programId: '', name: 'Pull', dayIndex: 1, exercises: [{ exerciseId: 'lat-pull', exerciseName: 'Lat', modality: 'tytax', sets: 1, reps: '8' }] },
      ],
    }, { activate: true });
    const first: WorkoutDraft = {
      id: 'd1', profileId, programId: program.id, programSessionId: 'a', sessionName: 'Push', startedAt: '2026-09-19T10:00:00.000Z',
      exercises: [se('u1', 'smith-press', { sets: [{ id: 's1', type: 'working', kg: 60, reps: 8, done: true }] })],
    };
    const { log } = await repo.finishWorkout(first, { finishedAt: '2026-09-19T11:00:00.000Z' });
    expect((await repo.programs.getActive(profileId))?.currentSessionIndex).toBe(1);

    expect(orch().repeatLog('someone-else', log)).toEqual({ ok: false, reason: 'foreign-log' });
    // A log in the trash never seeds a draft, even with replace.
    expect(orch().repeatLog(profileId, { ...log, deletedAt: '2026-09-19T12:00:00.000Z' }, { replace: true })).toEqual({ ok: false, reason: 'deleted-log' });
    expect(store().draft).toBeNull();
    store().startQuick(profileId, 'Busy');
    expect(orch().repeatLog(profileId, log)).toEqual({ ok: false, reason: 'draft-exists' });
    expect(store().draft?.sessionName).toBe('Busy');
    // The store itself refuses too (G4-25): no silent overwrite.
    expect(store().startFromLog(profileId, log)).toBeNull();
    expect(store().draft?.sessionName).toBe('Busy');
    // replace discards the busy draft first: its hold starts go with it.
    sessionStorage.setItem(`${HOLD_STORAGE_PREFIX}busy`, '1');
    const res = orch().repeatLog(profileId, log, { replace: true });
    expect(sessionStorage.getItem(`${HOLD_STORAGE_PREFIX}busy`)).toBeNull();
    if (!res.ok) throw new Error('expected a draft');
    expect(res.draft.sessionName).toBe('Push');
    expect(res.draft.programId).toBeUndefined();
    expect(res.draft.exercises[0].sets[0]).toMatchObject({ kg: 60, reps: 8, done: false, ghostKg: 60, ghostReps: 8 });

    // Nothing done yet → nothing is logged; once a set is done it saves without moving the rotation.
    await expect(orch().finish(undefined, profileId)).rejects.toBeInstanceOf(EmptyWorkoutError);
    const uid = res.draft.exercises[0].uid;
    store().toggleSetDone(uid, res.draft.exercises[0].sets[0].id);
    const out = await orch().finish(undefined, profileId);
    expect(out.log.id).toBe(res.draft.id);
    expect(out.advancedProgram).toBeUndefined();
    expect((await repo.programs.getActive(profileId))?.currentSessionIndex).toBe(1);
  });

  it('addExercise builds a time exercise without warm-ups; a time-only workout can be finished', async () => {
    store().startQuick(profileId, 'Core');
    const uid = await orch().addExercise(profileId, plank);
    const added = store().draft?.exercises.find((e) => e.uid === uid);
    expect(added?.sets.map((s) => [s.type, s.kg, s.reps])).toEqual([['working', 0, 0], ['working', 0, 0], ['working', 0, 0]]);
    const setId = added?.sets[0].id ?? '';
    store().updateSet(uid ?? '', setId, { durationSeconds: 40 }, 'time');
    store().toggleTimeSetDone(uid ?? '', setId);
    const out = await orch().finish(undefined, profileId);
    const logged = out.log.exercises[0].sets[0];
    expect(logged).toMatchObject({ done: true, durationSeconds: 40, kg: 0, reps: 0 });
  });
});
