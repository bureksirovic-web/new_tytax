import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SetEntry } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { training } from '@/lib/training';
import { buildSessionExercise } from '../session-builder';
import { createWorkoutOrchestrator, ForeignDraftError, isForeignDraft } from '../workout-orchestrator';
import { useWorkoutStore } from '../workout-store';
import { useUIStore } from '../ui-store';
import { ex, fakeCatalog, settings } from './g3-helpers';

const bench = ex('bench', [['Chest', 100]], { name: 'Bench' });
const swing = ex('kb-swing', [['Glutes', 100]], { name: 'KB Swing', modality: 'kettlebell' });
const catalog = fakeCatalog([bench, swing]);

const store = () => useWorkoutStore.getState();
const draft = () => {
  const d = store().draft;
  if (!d) throw new Error('expected a draft');
  return d;
};

describe('R06: ids without crypto.randomUUID (plain-http LAN)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    store().discard();
  });

  it('starts a workout, adds an exercise and a set, and toasts when randomUUID is missing', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    expect(typeof globalThis.crypto.randomUUID).toBe('undefined');

    const d = store().startQuick('p1', 'Quick');
    const uid = store().addExercise(bench);
    expect(uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    store().addSet(uid!);
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(draft().exercises[0].sets.length).toBeGreaterThan(1);
    // buildSessionExercise also calls training.prefillFromHistory, whose set ids get the same
    // fallback on v2-g1 (G1 part of R06); G3's own ids are covered here.
    useUIStore.getState().addToast('x', 'info');
    expect(useUIStore.getState().toasts.at(-1)?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('S3-01: done with empty reps adopts ghost reps, never records 0 reps', () => {
  beforeEach(() => store().discard());

  function withSet(set: Partial<SetEntry>) {
    store().startQuick('p1', 'Q');
    const uid = store().addExercise(bench)!;
    const id = draft().exercises[0].sets[0].id;
    store().updateSet(uid, id, { kg: 60, reps: 0, ...set });
    return { uid, id };
  }

  it('adopts ghostReps when reps are empty', () => {
    const { uid, id } = withSet({ ghostReps: 8 });
    store().toggleSetDone(uid, id);
    expect(draft().exercises[0].sets[0]).toMatchObject({ done: true, reps: 8, kg: 60 });
    expect(typeof draft().exercises[0].sets[0].completedAt).toBe('string');
  });

  it('keeps typed reps over ghost reps', () => {
    const { uid, id } = withSet({ reps: 5, ghostReps: 8 });
    store().toggleSetDone(uid, id);
    expect(draft().exercises[0].sets[0]).toMatchObject({ done: true, reps: 5 });
    expect(draft().exercises[0].sets[0].ghostReps).toBe(8);
  });

  it('refuses done with neither reps nor ghost reps', () => {
    const { uid, id } = withSet({});
    store().toggleSetDone(uid, id);
    expect(draft().exercises[0].sets[0].done).toBe(false);
    expect(draft().exercises[0].sets[0].reps).toBe(0);
    expect(draft().exercises[0].sets[0].completedAt).toBeUndefined();
  });
});

describe('G1-02: kettlebell prefill gets the owned bells', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes availableKg for kettlebell exercises only', () => {
    const spy = vi.spyOn(training, 'prefillFromHistory');
    buildSessionExercise({ exercise: swing, history: [], settings: settings(), availableKg: [12, 16, 24] });
    expect(spy.mock.calls[0][2]).toMatchObject({ availableKg: [12, 16, 24] });
    buildSessionExercise({ exercise: bench, history: [], settings: settings(), availableKg: [12, 16, 24] });
    expect(spy.mock.calls[1][2]).not.toHaveProperty('availableKg');
    buildSessionExercise({ exercise: swing, history: [], settings: settings(), availableKg: [] });
    expect(spy.mock.calls[2][2]).not.toHaveProperty('availableKg');
  });
});

let n = 0;
let repo: Repository;

describe('orchestrator: inventory + foreign drafts (R04)', () => {
  beforeEach(() => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`followup-${n}`) });
    store().discard();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  const orch = () => createWorkoutOrchestrator({ repo, loadCatalog: async () => catalog });

  it('loads the kettlebell inventory for a picked kettlebell exercise', async () => {
    const a = await repo.profiles.ensureActive('A');
    await repo.equipment.save(a.id, { kettlebellsKg: [16, 20] });
    const spy = vi.spyOn(training, 'prefillFromHistory');
    orch().startQuick(a.id, 'Q');
    await orch().addExercise(a.id, swing);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toMatchObject({ availableKg: [16, 20] });
    expect(draft().exercises).toHaveLength(1);
  });

  it('never adds to, swaps in or saves another profile\'s draft', async () => {
    const a = await repo.profiles.ensureActive('A');
    const b = await repo.profiles.create({ name: 'B' });
    orch().startQuick(a.id, 'Q');
    const uid = await orch().addExercise(a.id, bench);
    expect(uid).not.toBeNull();

    expect(isForeignDraft(draft(), b.id)).toBe(true);
    expect(isForeignDraft(draft(), a.id)).toBe(false);
    expect(isForeignDraft(null, b.id)).toBe(false);
    expect(await orch().addExercise(b.id, bench)).toBeNull();
    expect(await orch().swapExercise(b.id, uid!, bench)).toBeNull();
    expect(draft().exercises).toHaveLength(1);

    await expect(orch().finish(undefined, b.id)).rejects.toBeInstanceOf(ForeignDraftError);
    await expect(orch().finish(undefined, null)).rejects.toBeInstanceOf(ForeignDraftError);
    expect(await repo.logs.list(a.id)).toHaveLength(0);
    expect(await repo.logs.list(b.id)).toHaveLength(0);
    expect(draft().profileId).toBe(a.id);
  });

  it('saves the owner\'s draft when it is the active profile', async () => {
    const a = await repo.profiles.ensureActive('A');
    orch().startQuick(a.id, 'Q');
    const uid = (await orch().addExercise(a.id, bench))!;
    const set = draft().exercises[0].sets.find((s) => s.type === 'working')!;
    store().updateSet(uid, set.id, { kg: 50, reps: 5 });
    store().toggleSetDone(uid, set.id);
    const res = await orch().finish(undefined, a.id);
    expect(res.log.profileId).toBe(a.id);
    expect(res.log.totalSets).toBe(1);
    expect(await repo.logs.list(a.id)).toHaveLength(1);
  });

  it('builds kettlebell program slots with the inventory too', async () => {
    const a = await repo.profiles.ensureActive('A');
    await repo.equipment.save(a.id, { kettlebellsKg: [24] });
    await repo.programs.create(
      a.id,
      {
        name: 'KB', splitType: 'custom', frequency: 1, periodizationType: 'none', sessionOrder: ['KB'],
        sessions: [{ id: 'k', programId: '', name: 'KB', dayIndex: 0, exercises: [{ exerciseId: 'kb-swing', exerciseName: 'KB Swing', modality: 'kettlebell', sets: 2, reps: '15' }] }],
        modalitiesUsed: ['kettlebell'], isPreset: false, currentSessionIndex: 0,
      },
      { activate: true },
    );
    const spy = vi.spyOn(training, 'prefillFromHistory');
    const plan = await orch().prepareProgramStart(a.id);
    expect(plan?.session.exercises).toHaveLength(1);
    expect(spy.mock.calls[0][2]).toMatchObject({ availableKg: [24] });
  });
});
