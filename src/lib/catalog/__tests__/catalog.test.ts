import { beforeEach, describe, expect, it } from 'vitest';
import { catalog, getById, loadCatalog, normalizeText, preloadAll, resetCatalogForTests, search } from '../index';
import { chunkForId, isExercise } from '../chunks';

const SMITH_FLAT = 'tytax_smith-machine_smith-flat-bench-press';

beforeEach(() => {
  resetCatalogForTests();
});

describe('loadCatalog', () => {
  it('loads each chunk with its full exercise count', async () => {
    // 1409 = 1436 source entries − 27 promo/delivery videos (docs/v2/station-unresolved.md)
    expect((await loadCatalog(['tytax'])).exercises).toHaveLength(1409);
    // 82 = objects with an `id: 'bw_…'` key in src/data/bodyweight/exercises.ts
    expect((await loadCatalog(['bodyweight'])).exercises).toHaveLength(82);
    // 75 = objects with an `id: 'kb_…'` key in src/data/kettlebell/exercises.ts
    expect((await loadCatalog(['kettlebell'])).exercises).toHaveLength(75);
  });

  it('defaults to every chunk, in canonical order', async () => {
    const all = await loadCatalog();
    // 1409 + 82 + 75 = 1566
    expect(all.exercises).toHaveLength(1566);
    expect(all.chunks).toEqual(['tytax', 'bodyweight', 'kettlebell']);
    expect(all.exercises[0].modality).toBe('tytax');
    expect(all.exercises.at(-1)?.modality).toBe('kettlebell');
  });

  it('memoises: two loads return the same catalog and exercise array', async () => {
    const a = await loadCatalog();
    const b = await loadCatalog(['kettlebell', 'tytax', 'bodyweight', 'tytax']);
    expect(b).toBe(a);
    expect(b.exercises).toBe(a.exercises);
    const t1 = await loadCatalog(['tytax']);
    const t2 = await catalog.loadCatalog(['tytax']);
    expect(t2.exercises).toBe(t1.exercises);
  });

  it('every entry passes the structural guard', async () => {
    const all = await loadCatalog();
    expect(all.exercises.every(isExercise)).toBe(true);
  });

  it('only the tytax chunk carries stations and attachments', async () => {
    const t = await loadCatalog(['tytax']);
    // 7 stations = 5 tytax_library.json STATIONS + app-level FRAME and FREE_WEIGHT; 9 RECOMMENDED_ATTACHMENTS (src/data/tytax/library.json)
    expect(t.stations).toHaveLength(7);
    expect(t.attachments).toHaveLength(9);
    expect(t.stations.find((s) => s.id === 'SMITH')?.name).toBe('Smith Machine');
    expect(t.stations.slice(-2).map((s) => s.name)).toEqual(['Frame', 'Free weights']);
    expect(t.attachments.map((a) => a.id)).toContain('TRICEPS_ROPE');
    const bw = await loadCatalog(['bodyweight']);
    expect(bw.stations).toHaveLength(0);
    expect(bw.attachments).toHaveLength(0);
  });

  it('sync lookups on a loaded catalog', async () => {
    const all = await loadCatalog();
    expect(all.getById(SMITH_FLAT)?.name).toBe('Smith Flat Bench Press');
    expect(all.getById('bw_push_wall-push-up')?.modality).toBe('bodyweight');
    expect(all.getById('nope')).toBeUndefined();
    expect(all.getByLegacyName('smith FLAT bench press')?.id).toBe(SMITH_FLAT);
    expect(all.getByLegacyName('Two-Hand Swing')?.id).toBe('kb_swing_two-hand-swing');
    expect(all.getByLegacyName('does not exist')).toBeUndefined();
    // master-list form and the original app's cleanName form both resolve
    expect(all.getByLegacyName('TYTAX T1 | Smith Flat Bench Press')?.id).toBe(SMITH_FLAT);
    expect(all.getByLegacyName('TYTAX® T1-X | Smith Flat Bench Press')?.id).toBe(SMITH_FLAT);
    // reviewed alias (scripts/data/aliases.json): INITIAL_PLAN Upper C #3
    expect(all.getByLegacyName('TYTAX T1 | Lower Pulley Single-Arm Seated Cable Row')?.name).toBe('Lower Pulley One-Arm Seated Cable Row');
    // display-name override keeps the source name as a legacy key
    expect(all.getByLegacyName('NEvUVCFF8x8')?.name).toBe('Triceps Elbow Extension (T1-X #1590)');
  });
});

describe('getById', () => {
  it('infers the chunk from the id prefix', () => {
    expect(chunkForId(SMITH_FLAT)).toBe('tytax');
    expect(chunkForId('bw_push_wall-push-up')).toBe('bodyweight');
    expect(chunkForId('kb_swing_two-hand-swing')).toBe('kettlebell');
    expect(chunkForId('custom-123')).toBeUndefined();
  });

  it('resolves ids from each chunk and misses unknown ids', async () => {
    expect((await getById(SMITH_FLAT))?.station).toBe('Smith Machine');
    expect((await getById('bw_push_wall-push-up'))?.name).toBe('Wall Push-Up');
    expect((await catalog.getById('kb_swing_two-hand-swing'))?.name).toBe('Two-Hand Swing');
    expect(await getById('custom-123')).toBeUndefined();
    expect(await getById('kb_does-not-exist')).toBeUndefined();
  });
});

describe('search', () => {
  it("finds the Smith flat bench press for 'smith flat'", async () => {
    const hits = await search({ text: 'smith flat' });
    expect(hits.map((e) => e.id)).toContain(SMITH_FLAT);
    // every word must match somewhere
    expect(hits.every((e) => /smith/i.test(e.name + e.pattern) && /flat/i.test(e.name + e.pattern))).toBe(true);
  });

  it('is case- and diacritic-insensitive', async () => {
    expect(normalizeText('Čučanj ŠIPKA')).toBe('cucanj sipka');
    const hits = await search({ text: 'SMÍTH  flàt' });
    expect(hits.map((e) => e.id)).toContain(SMITH_FLAT);
  });

  it('requires all words to match', async () => {
    expect(await search({ text: 'smith zzzqqq' })).toHaveLength(0);
  });

  it('filters by modality, with all meaning no filter', async () => {
    const kb = await search({ modality: 'kettlebell' });
    // 75 kettlebell entries (see chunk count above)
    expect(kb).toHaveLength(75);
    // 1566 = all chunks
    expect(await search({ modality: 'all' })).toHaveLength(1566);
    expect(await search({ modality: 'custom' })).toHaveLength(0);
  });

  it('filters by muscle group, pattern and impact muscle', async () => {
    const calves = await search({ muscleGroup: 'CALVES' });
    expect(calves.length).toBeGreaterThan(0);
    expect(calves.every((e) => e.muscleGroup === 'CALVES')).toBe(true);
    const hinge = await search({ modality: 'kettlebell', pattern: 'HINGE' });
    expect(hinge.map((e) => e.id)).toContain('kb_swing_two-hand-swing');
    expect(hinge.every((e) => e.pattern.toLowerCase() === 'hinge')).toBe(true);
    const neck = await search({ muscle: 'neck' });
    expect(neck.map((e) => e.id)).toContain('tytax_tytax_lever-neck-flexion');
    // kettlebell 'lower back' standardises to Spinal Erectors
    const erectors = await search({ modality: 'kettlebell', muscle: 'spinal erectors' });
    expect(erectors.map((e) => e.id)).toContain('kb_swing_two-hand-swing');
  });

  it('filters by station and attachment', async () => {
    const legExt = await search({ stationId: 'LEG_EXTENSION' });
    // 2 from the source's 'Leg Extension Seat' + 2 cable leg extensions (name-rule:leg-extension)
    expect(legExt.map((e) => e.id).sort()).toEqual([
      'tytax_leg-extension_seated-leg-extension',
      'tytax_leg-extension_seated-single-leg-leg-extension',
      'tytax_tytax_seated-alternating-cable-leg-extension',
      'tytax_tytax_seated-cable-leg-extension',
    ]);
    // 36 = the free-weight bucket of docs/v2/station-unresolved.md before F1 (dumbbell/barbell/EZ-bar names, name-rule:free-weight)
    expect(await search({ stationId: 'FREE_WEIGHT' })).toHaveLength(36);
    // 28 = 25 pull-up/dip/hanging/roman-chair/hyperextension names (name-rule:frame) + 3 bench bodyweight (name-rule:frame-bench)
    expect(await search({ stationId: 'FRAME' })).toHaveLength(28);
    const rope = await search({ attachmentId: 'TRICEPS_ROPE', text: 'face pull' });
    expect(rope.length).toBeGreaterThan(0);
    expect(rope.every((e) => e.modality === 'tytax')).toBe(true);
    expect(await search({ stationId: 'no-such-station' })).toHaveLength(0);
  });

  it('honours the limit', async () => {
    expect(await search({ modality: 'tytax', limit: 5 })).toHaveLength(5);
    expect(await search({ text: 'press', limit: 0 })).toHaveLength(0);
  });
});

describe('preloadAll', () => {
  it('warms every chunk so later loads reuse it', async () => {
    await preloadAll();
    const all = await loadCatalog();
    expect(all.chunks).toHaveLength(3);
    expect(await catalog.preloadAll()).toBeUndefined();
  });
});
