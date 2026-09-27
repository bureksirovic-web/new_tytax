import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramTemplate, WorkoutDraft } from '@/contracts/domain';
import type { SeedLogInput } from '@/contracts/fixtures';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { WORKOUT_DRAFT_STORAGE_KEY } from '@/stores/workout-store';
import { createE2EHooks, installE2EHooks, readPersistedDraft } from '../e2e-hooks';

const TEMPLATE: ProgramTemplate = {
  name: 'Seed Split',
  splitType: 'custom',
  frequency: 2,
  periodizationType: 'none',
  sessionOrder: ['Day A'],
  sessions: [
    {
      id: 'seed-session-a',
      programId: 'seed-program',
      name: 'Day A',
      dayIndex: 0,
      exercises: [
        {
          exerciseId: 'tytax_smith-machine_smith-flat-bench-press',
          exerciseName: 'Smith Flat Bench Press',
          modality: 'tytax',
          sets: 3,
          reps: '6-10',
        },
      ],
    },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: true,
  presetId: 'seed-preset',
  currentSessionIndex: 0,
};

vi.mock('@/lib/programs/presets', () => ({
  getPresetById: (id: string) => (id === 'seed-preset' ? TEMPLATE : undefined),
}));

const BENCH: SeedLogInput['exercises'][number] = {
  exerciseId: 'tytax_smith-machine_smith-flat-bench-press',
  exerciseName: 'Smith Flat Bench Press',
  sets: [
    { kg: 60, reps: 8, rir: 2 },
    { kg: 62.5, reps: 8, rir: 2 },
  ],
};

let dbCount = 0;
let repo: Repository;

beforeEach(() => {
  dbCount += 1;
  repo = createRepository({ db: new TytaxDatabase(`e2e-hooks-test-${dbCount}`) });
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.__tytaxE2E;
});

function hooksFor(r: Repository) {
  return createE2EHooks(r, { defaultProfileName: 'Profil 1' });
}

describe('createE2EHooks', () => {
  it('is ready and reports the build SHA', () => {
    vi.stubEnv('NEXT_PUBLIC_GIT_SHA', 'abc123');
    const hooks = hooksFor(repo);
    expect(hooks.ready).toBe(true);
    expect(hooks.sha).toBe('abc123');
  });

  it('reset wipes data and the persisted draft, then re-creates the default profile', async () => {
    const hooks = hooksFor(repo);
    const seeded = await hooks.seedProfile({ name: 'Old' });
    await hooks.seedHistory(seeded.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, '{"state":{"draft":null},"version":3}');

    await hooks.reset();

    const { activeProfileId } = await hooks.snapshot();
    const profiles = await repo.profiles.list();
    // 1: resetAll wiped "Old"; ensureActive created exactly one profile.
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Profil 1');
    expect(activeProfileId).toBe(profiles[0].id);
    // 0: the seeded log belonged to the wiped profile.
    expect(await repo.logs.count(seeded.id, { includeDeleted: true })).toBe(0);
    expect(window.localStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('seedProfile activates by default and not when activate is false', async () => {
    const hooks = hooksFor(repo);
    const first = await hooks.seedProfile();
    expect(first.name).toBe('Test');
    expect(await repo.profiles.getActiveId()).toBe(first.id);

    const second = await hooks.seedProfile({ name: 'Second', settings: { units: 'lb' }, activate: false });
    expect(second.settings.units).toBe('lb');
    expect(await repo.profiles.getActiveId()).toBe(first.id);
  });

  it('seedHistory writes built logs through the repository; soft-deleted ones stay hidden', async () => {
    const hooks = hooksFor(repo);
    const profile = await hooks.seedProfile();
    const built = await hooks.seedHistory(profile.id, [
      { daysAgo: 1, exercises: [BENCH] },
      { daysAgo: 2, deleted: true, exercises: [BENCH] },
    ]);

    // 2: one built log per input.
    expect(built).toHaveLength(2);
    // 60×8 + 62.5×8 = 480 + 500 = 980 kg over two done working sets.
    expect(built[0].totalVolumeKg).toBe(980);
    // 2: both BENCH sets default to done working sets.
    expect(built[0].totalSets).toBe(2);
    const visible = await hooks.listLogs(profile.id);
    expect(visible.map((l) => l.id)).toEqual([built[0].id]);
    // 2: includeDeleted also returns the soft-deleted log.
    expect(await repo.logs.count(profile.id, { includeDeleted: true })).toBe(2);
  });

  it('seedProgram installs a preset or a template and activates unless told not to', async () => {
    const hooks = hooksFor(repo);
    const profile = await hooks.seedProfile();

    const fromPreset = await hooks.seedProgram(profile.id, { presetId: 'seed-preset' });
    expect(fromPreset.name).toBe('Seed Split');
    expect((await repo.profiles.get(profile.id))?.activeProgramId).toBe(fromPreset.id);

    const fromTemplate = await hooks.seedProgram(profile.id, {
      template: { ...TEMPLATE, name: 'Inline' },
      activate: false,
    });
    expect(fromTemplate.name).toBe('Inline');
    expect((await repo.profiles.get(profile.id))?.activeProgramId).toBe(fromPreset.id);
  });

  it('seedProgram rejects an unknown preset and an empty input', async () => {
    const hooks = hooksFor(repo);
    const profile = await hooks.seedProfile();
    await expect(hooks.seedProgram(profile.id, { presetId: 'nope' })).rejects.toThrow('unknown preset id "nope"');
    await expect(hooks.seedProgram(profile.id, {})).rejects.toThrow('pass presetId or template');
  });

  it('setActiveProfile and listProfiles go straight to the repository (G2-01)', async () => {
    const hooks = hooksFor(repo);
    const first = await hooks.seedProfile({ name: 'First' });
    const second = await hooks.seedProfile({ name: 'Second', activate: false });
    expect(await repo.profiles.getActiveId()).toBe(first.id);

    await hooks.setActiveProfile(second.id);

    expect(await repo.profiles.getActiveId()).toBe(second.id);
    expect((await hooks.snapshot()).activeProfileId).toBe(second.id);
    const listed = await hooks.listProfiles();
    expect(listed.map((p) => p.id).sort()).toEqual([first.id, second.id].sort());
    expect(listed).toEqual(await repo.profiles.list());
  });

  it('listPRRecords returns the repository PR records of that profile only (G3-03)', async () => {
    const hooks = hooksFor(repo);
    const me = await hooks.seedProfile({ name: 'Me' });
    const other = await hooks.seedProfile({ name: 'Other', activate: false });
    await hooks.seedHistory(me.id, [{ daysAgo: 1, exercises: [BENCH] }]);

    const records = await hooks.listPRRecords(me.id);
    expect(records).toEqual(await repo.prs.list(me.id));
    expect(records.every((r) => r.profileId === me.id)).toBe(true);
    expect(await hooks.listPRRecords(other.id)).toEqual([]);
  });

  it('removeProfile wipes only that profile and its data (G2-01)', async () => {
    const hooks = hooksFor(repo);
    const keep = await hooks.seedProfile({ name: 'Keep' });
    const gone = await hooks.seedProfile({ name: 'Gone' });
    await hooks.seedHistory(keep.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    await hooks.seedHistory(gone.id, [
      { daysAgo: 1, exercises: [BENCH] },
      { daysAgo: 2, exercises: [BENCH] },
    ]);
    expect(await repo.profiles.getActiveId()).toBe(gone.id);

    await hooks.removeProfile(gone.id);

    expect((await hooks.listProfiles()).map((p) => p.id)).toEqual([keep.id]);
    // 0: both of Gone's logs were wiped, soft-deleted or not.
    expect(await repo.logs.count(gone.id, { includeDeleted: true })).toBe(0);
    // 1: Keep's one seeded log is untouched.
    expect(await repo.logs.count(keep.id, { includeDeleted: true })).toBe(1);
    // The removed profile was active, so the remaining one took over (ProfilesRepo.remove contract).
    expect(await repo.profiles.getActiveId()).toBe(keep.id);
  });

  it('the profile hooks reject what the repository rejects', async () => {
    const hooks = hooksFor(repo);
    const spy = vi.spyOn(repo.profiles, 'setActive').mockRejectedValueOnce(new Error('no such profile'));
    await expect(hooks.setActiveProfile('missing')).rejects.toThrow('no such profile');
    expect(spy).toHaveBeenCalledWith('missing');
  });

  it('installE2EHooks puts the hooks on window', () => {
    const hooks = installE2EHooks(repo, { defaultProfileName: 'Profil 1' });
    expect(window.__tytaxE2E).toBe(hooks);
    expect(window.__tytaxE2E?.ready).toBe(true);
    expect(typeof window.__tytaxE2E?.setActiveProfile).toBe('function');
    expect(typeof window.__tytaxE2E?.removeProfile).toBe('function');
    expect(typeof window.__tytaxE2E?.listProfiles).toBe('function');
  });
});

describe('readPersistedDraft', () => {
  const draft: WorkoutDraft = {
    id: 'draft-1',
    profileId: 'p-1',
    sessionName: 'Quick Workout',
    startedAt: '2026-09-26T20:00:00.000Z',
    exercises: [],
  };

  it('returns the draft the workout store persisted', () => {
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ state: { draft }, version: 3 }));
    expect(readPersistedDraft(window.localStorage)).toEqual(draft);
  });

  it('returns null for a missing key, no draft, malformed JSON or a wrong shape', () => {
    expect(readPersistedDraft(window.localStorage)).toBeNull();
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ state: { draft: null }, version: 3 }));
    expect(readPersistedDraft(window.localStorage)).toBeNull();
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, '{not json');
    expect(readPersistedDraft(window.localStorage)).toBeNull();
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ state: { draft: { id: 1 } } }));
    expect(readPersistedDraft(window.localStorage)).toBeNull();
  });

  it('is what snapshot() reports', async () => {
    window.localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ state: { draft }, version: 3 }));
    const snap = await hooksFor(repo).snapshot();
    expect(snap.draft).toEqual(draft);
    expect(snap.activeProfileId).toBeNull();
  });
});
