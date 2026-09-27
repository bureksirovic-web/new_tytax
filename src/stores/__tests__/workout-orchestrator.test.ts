import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ProgramTemplate, SetEntry, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { createWorkoutOrchestrator, EmptyWorkoutError, settingsOf } from '../workout-orchestrator';
import { useWorkoutStore } from '../workout-store';
import { ex, fakeCatalog } from './g3-helpers';

const NOW = new Date('2026-09-20T12:00:00.000Z');
const HOUR = 3_600_000;
const bench = ex('bench', [['Chest', 100]], { name: 'Bench' });
const legExt = ex('leg-ext', [['Quads', 100]], { name: 'Leg Extension', stationId: 'LEG_EXTENSION' });
const row = ex('row', [['Lats', 90]], { name: 'Row' });
const catalog = fakeCatalog([bench, legExt, row]);

const template: ProgramTemplate = {
  name: 'Two day', splitType: 'custom', frequency: 2, periodizationType: 'none', sessionOrder: ['Push', 'Rest'],
  sessions: [
    { id: 'push', programId: '', name: 'Push', dayIndex: 0, exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: 3, reps: '8' }] },
    { id: 'rest', programId: '', name: 'Rest', dayIndex: 1, exercises: [], isRest: true },
  ],
  modalitiesUsed: ['tytax'], isPreset: false, currentSessionIndex: 0,
};

let n = 0;
let repo: Repository;
let profileId: string;

const working = (kg: number, count: number, rir?: number): SetEntry[] =>
  Array.from({ length: count }, (_, i) => ({ id: `s${i}`, type: 'working', kg, reps: 8, rir, done: true }));

/** Finishes a bench workout that ended `hoursAgo` before NOW. */
async function seedBench(hoursAgo: number, sets: SetEntry[]): Promise<void> {
  n += 1;
  const end = NOW.getTime() - hoursAgo * HOUR;
  const draft: WorkoutDraft = {
    id: `log-${n}`, profileId, sessionName: 'Old', startedAt: new Date(end - HOUR).toISOString(),
    exercises: [{ uid: `u${n}`, exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets }],
  };
  await repo.finishWorkout(draft, { finishedAt: new Date(end).toISOString() });
}

const orch = () => createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog, now: () => NOW });
const draft = () => {
  const d = useWorkoutStore.getState().draft;
  if (!d) throw new Error('expected a draft');
  return d;
};

describe('workout orchestrator', () => {
  beforeEach(async () => {
    n += 100;
    repo = createRepository({ db: new TytaxDatabase(`orch-${n}`) });
    profileId = (await repo.profiles.ensureActive('Me')).id;
    useWorkoutStore.getState().discard();
    localStorage.clear();
  });

  it('startQuick, addExercise (prefilled + warm-ups) and swapExercise', async () => {
    await seedBench(72, working(100, 3, 3));
    const o = orch();
    o.startQuick(profileId, 'Quick');
    const uid = await o.addExercise(profileId, bench);
    // 100 RIR 3 → 102.5 ×3; standard warm-ups 52.5, 77.5.
    expect(draft().exercises[0].sets.map((s) => s.kg)).toEqual([52.5, 77.5, 102.5, 102.5, 102.5]);
    const swapped = await o.swapExercise(profileId, uid ?? '', row);
    expect(swapped).toBe(uid);
    // Row has no history: 3 empty working sets (old working count).
    expect(draft().exercises[0].sets.map((s) => [s.type, s.kg])).toEqual([['working', 0], ['working', 0], ['working', 0]]);
    expect(await o.swapExercise(profileId, 'missing', row)).toBeNull();
  });

  it('youth profile (birthYear set): addExercise caps the automatic increase to +1.25 kg', async () => {
    await repo.profiles.update(profileId, { birthYear: NOW.getUTCFullYear() - 11 });
    await seedBench(72, working(100, 3, 3));
    const o = orch();
    o.startQuick(profileId, 'Quick');
    await o.addExercise(profileId, bench);
    // 100 RIR 3: adult would be 102.5 (+2.5); youth caps the increase to +1.25 -> 101.25.
    expect(draft().exercises[0].sets.filter((s) => s.type === 'working').map((s) => s.kg)).toEqual([101.25, 101.25, 101.25]);
  });

  it('youth profile: starting a program session also caps the increase (full path: profile -> draft prefill)', async () => {
    await repo.profiles.update(profileId, { birthYear: NOW.getUTCFullYear() - 11 });
    await seedBench(72, working(100, 3, 3));
    await repo.programs.create(profileId, template, { activate: true });
    const o = orch();
    const prepared = await o.prepareProgramStart(profileId);
    o.startProgram(prepared!, { deload: false, weakPoint: false });
    expect(draft().exercises[0].sets.filter((s) => s.type === 'working').map((s) => s.kg)).toEqual([101.25, 101.25, 101.25]);
  });

  it('add and swap in a deload draft are deloaded; a swap after done sets takes only the sets still to do', async () => {
    await seedBench(72, working(100, 3, 3));
    const o = orch();
    useWorkoutStore.getState().startDraft({
      profileId, sessionName: 'Deload', isDeload: true,
      exercises: [{ uid: 'a', exerciseId: 'row', exerciseName: 'Row', modality: 'tytax',
        sets: [0, 1, 2].map((i) => ({ id: `w${i}`, type: 'working' as const, kg: 60, reps: 8, done: i === 0 })) }],
    });
    await o.addExercise(profileId, bench);
    // Normal prefill would be 102.5 ×3; deload: −1 set, ×0.85 → 87.5 ×2.
    expect(draft().exercises[1].sets.filter((s) => s.type !== 'warmup').map((s) => s.kg)).toEqual([87.5, 87.5]);
    const uid = await o.swapExercise(profileId, 'a', bench);
    expect(uid).not.toBe('a');
    // Old keeps only its done set; the new one gets the 2 sets still to do, deloaded.
    expect(draft().exercises[0].sets.map((s) => [s.id, s.done])).toEqual([['w0', true]]);
    expect(draft().exercises[1].sets.filter((s) => s.type !== 'warmup').map((s) => s.kg)).toEqual([87.5, 87.5]);
    expect(draft().exercises.map((e) => e.exerciseId)).toEqual(['row', 'bench', 'bench']);
  });

  it('prepareProgramStart → deload offer when fried; accepting marks isDeload and deloads', async () => {
    const program = await repo.programs.create(profileId, template, { activate: true });
    await seedBench(10, working(100, 6, 3)); // 6 Chest sets within 48 h → fried
    const o = orch();
    const prepared = await o.prepareProgramStart(profileId);
    expect(prepared?.offers.deload?.recovery.overall).toBe('fried');
    expect(prepared?.offers.weakPoint).toBeUndefined();
    const d = o.startProgram(prepared!, { deload: true, weakPoint: true });
    // 3 slot sets at 102.5 → deload: 2 sets at 87.5; warm-ups regenerated: 45, 65.
    expect(d.exercises[0].sets.map((s) => s.kg)).toEqual([45, 65, 87.5, 87.5]);
    expect([d.isDeload, d.sessionName, d.programSessionId]).toEqual([true, 'Push', program.sessions[0].id]);
    expect(d.programId).toBe(program.id);
  });

  it('declining the deload keeps the plan; weak point appended when fresh and opted in', async () => {
    await repo.programs.create(profileId, template, { activate: true });
    await repo.profiles.updateSettings(profileId, { weakPointInjector: true });
    await seedBench(72, working(100, 3, 3));
    const o = orch();
    const prepared = await o.prepareProgramStart(profileId);
    expect(prepared?.offers.deload).toBeUndefined();
    expect(prepared?.offers.weakPoint?.exercise.id).toBe('leg-ext');
    const declined = o.startProgram(prepared!, { deload: false, weakPoint: false });
    expect(declined.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
    expect(declined.isDeload).toBeUndefined();
    const accepted = o.startProgram(prepared!, { deload: true, weakPoint: true });
    expect(accepted.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'leg-ext']);
    expect(accepted.exercises[1].sets).toHaveLength(2);
    expect(accepted.isDeload).toBeUndefined(); // no deload offer → not a deload
  });

  it('null without a program or on a rest session; skipRestDay advances', async () => {
    const o = orch();
    expect(await o.prepareProgramStart(profileId)).toBeNull();
    expect(await o.skipRestDay(profileId)).toBeNull();
    const p = await repo.programs.create(profileId, { ...template, currentSessionIndex: 1 }, { activate: true });
    expect(await o.prepareProgramStart(profileId)).toBeNull();
    const advanced = await o.skipRestDay(profileId);
    expect(advanced?.id).toBe(p.id);
    expect(advanced?.currentSessionIndex).toBe(0);
  });

  it('youth: skipRestDay refuses a rest day reached the same calendar day, allows it the next day', async () => {
    await repo.profiles.update(profileId, { birthYear: NOW.getFullYear() - 11 });
    // The program advanced "today" (relative to the injected clock).
    const p = await repo.programs.create(profileId, { ...template, currentSessionIndex: 1 }, { activate: true });
    await repo.programs.update(profileId, p.id, { name: p.name });
    const stamped = await repo.programs.getActive(profileId);
    const sameDay = createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog, now: () => new Date(stamped!.updatedAt) });
    const refused = await sameDay.skipRestDay(profileId);
    expect(refused?.currentSessionIndex).toBe(1);
    expect((await repo.programs.getActive(profileId))?.currentSessionIndex).toBe(1);
    const nextDay = new Date(new Date(stamped!.updatedAt).getTime() + 26 * 3600 * 1000);
    const later = createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog, now: () => nextDay });
    const advanced = await later.skipRestDay(profileId);
    expect(advanced?.currentSessionIndex).toBe(0);
  });

  it('skipRestDay never skips a training session: concurrent taps land on the next one', async () => {
    const three: ProgramTemplate = {
      ...template,
      sessions: [...template.sessions, { id: 'pull', programId: '', name: 'Pull', dayIndex: 2, exercises: [{ exerciseId: 'row', exerciseName: 'Row', modality: 'tytax', sets: 3, reps: '8' }] }],
      currentSessionIndex: 1,
    };
    await repo.programs.create(profileId, three, { activate: true });
    const o = orch();
    const [a, b] = await Promise.all([o.skipRestDay(profileId), o.skipRestDay(profileId)]);
    expect([a?.currentSessionIndex, b?.currentSessionIndex]).toEqual([2, 2]);
    const again = await o.skipRestDay(profileId);
    expect(again?.currentSessionIndex).toBe(2);
    const stored = await repo.programs.getActive(profileId);
    expect(stored?.sessions[stored.currentSessionIndex].name).toBe('Pull');
  });

  it('finish refuses a workout with no done working set: no log, rotation stays', async () => {
    const program = await repo.programs.create(profileId, template, { activate: true });
    const o = orch();
    o.startQuick(profileId, 'Quick');
    const d = draft();
    useWorkoutStore.setState({ draft: { ...d, programId: program.id, programSessionId: program.sessions[0].id } });
    useWorkoutStore.getState().addPreparedExercise({ uid: 'u', exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: [
      { id: 'w', type: 'warmup', kg: 40, reps: 10, done: true },
      { id: 'a', type: 'working', kg: 60, reps: 5, done: false },
      { id: 'z', type: 'working', kg: 60, reps: 0, done: true },
    ] });
    await expect(o.finish({ rpe: 8 })).rejects.toBeInstanceOf(EmptyWorkoutError);
    expect(await repo.logs.count(profileId)).toBe(0);
    expect((await repo.programs.getActive(profileId))?.currentSessionIndex).toBe(0);
    expect(useWorkoutStore.getState().draft).not.toBeNull();
  });

  it('finish writes the log and leaves the draft for the caller', async () => {
    const o = orch();
    await expect(o.finish()).rejects.toThrow();
    o.startQuick(profileId, 'Quick');
    useWorkoutStore.getState().addPreparedExercise({ uid: 'u', exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: working(50, 1) });
    const res = await o.finish({ rpe: 8 });
    expect(res.log.id).toBe(draft().id);
    expect(res.log.rpe).toBe(8);
    expect(await repo.logs.count(profileId)).toBe(1);
  });

  it('settingsOf merges defaults', () => {
    expect(settingsOf(undefined).restSeconds).toBe(90);
  });
});
