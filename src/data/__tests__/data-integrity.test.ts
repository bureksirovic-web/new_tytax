/**
 * AC8 data integrity (PLAN §10.2): presets resolve, stations are valid library
 * ids (5 from tytax_library.json + the app-level FRAME and FREE_WEIGHT) with
 * provenance, station-less entries are listed against the fixed denominator of
 * 1,436, time-measured exercises follow `isTimeTarget`, and the committed
 * catalog matches a fresh build.
 * Command: npm test -- data-integrity
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import { ALL_PRESETS } from '@/lib/programs/presets';
import { loadCatalog } from '@/lib/catalog';
import tytax from '@/data/tytax/exercises.json';
import library from '@/data/tytax/library.json';
import legacyNames from '@/data/tytax/legacy-names.json';
import { buildCatalog, isTimeTarget } from '../../../scripts/data/catalog-lib';
import { APP_LEVEL_NOTE_PREFIX } from '../../../scripts/data/station-rules';
import { loadInputs, OUTPUT_PATHS, renderOutputs, PREVIOUS_IDS_PATH } from '../../../scripts/data/build-catalog';

const ROOT = resolve(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');
const exercises = tytax as unknown as Exercise[];
const STATION_KEYS = new Set(library.stations.map((s) => s.id));
const ATTACHMENT_KEYS = new Set(library.attachments.map((a) => a.id));
const SOURCE_TOTAL = 1436;

describe('data integrity (AC8)', () => {
  it('every preset exercise id resolves in the catalog', async () => {
    const cat = await loadCatalog();
    const slots = ALL_PRESETS.flatMap((p) => p.sessions.flatMap((s) => s.exercises.map((ex) => ({ preset: p.presetId, ...ex }))));
    // 33 (original split) + 36 (Elite v3) TYTAX slots, plus the bodyweight and kettlebell slots
    expect(slots.length).toBeGreaterThan(69);
    const missing = slots.filter((s) => !cat.getById(s.exerciseId)).map((s) => `${s.preset}:${s.exerciseId}`);
    expect(missing).toEqual([]);
    const renamed = slots.filter((s) => cat.getById(s.exerciseId)?.name !== s.exerciseName).map((s) => s.exerciseId);
    expect(renamed).toEqual([]);
  });

  it('no TYTAX exercise has the generic station "Tytax"', () => {
    expect(exercises.filter((e) => e.station === 'Tytax' || e.stationId === 'Tytax')).toEqual([]);
    expect(exercises.every((e) => e.modality === 'tytax')).toBe(true);
  });

  it('every station and attachment is a valid library.json id with a provenance', () => {
    // 7 = 5 tytax_library.json STATIONS (SMITH, BACK_UPPER, BACK_LOWER, LEG_EXTENSION, LEG_CURL) + app-level FRAME, FREE_WEIGHT
    expect(STATION_KEYS.size).toBe(7);
    expect([...STATION_KEYS].sort()).toEqual(['BACK_LOWER', 'BACK_UPPER', 'FRAME', 'FREE_WEIGHT', 'LEG_CURL', 'LEG_EXTENSION', 'SMITH']);
    const mapped = exercises.filter((e) => e.stationId !== undefined);
    expect(mapped.filter((e) => !STATION_KEYS.has(e.stationId as string)).map((e) => e.id)).toEqual([]);
    expect(exercises.flatMap((e) => e.attachmentIds ?? []).filter((a) => !ATTACHMENT_KEYS.has(a))).toEqual([]);
    const provenance = /^(t1x-meta|manual|name-rule:[a-z0-9-]+)$/;
    expect(mapped.filter((e) => !provenance.test(e.stationProvenance ?? '')).map((e) => e.id)).toEqual([]);
    // A station without provenance, or provenance without a station, is a build bug.
    expect(exercises.filter((e) => (e.stationId === undefined) !== (e.stationProvenance === undefined)).map((e) => e.id)).toEqual([]);
  });

  it('library.json marks exactly FRAME and FREE_WEIGHT as app-level; the rest are the tytax_library.json STATIONS', () => {
    const appLevel = library.stations.filter((s) => (s.notes ?? '').startsWith(APP_LEVEL_NOTE_PREFIX)).map((s) => s.id);
    expect(appLevel).toEqual(['FRAME', 'FREE_WEIGHT']);
    const source = JSON.parse(read('scripts/data/source/tytax_library.json')).STATIONS as Array<{ key: string }>;
    expect(library.stations.filter((s) => !appLevel.includes(s.id)).map((s) => s.id)).toEqual(source.map((s) => s.key));
    expect(library.stations.find((s) => s.id === 'FRAME')?.name).toBe('Frame');
    expect(library.stations.find((s) => s.id === 'FREE_WEIGHT')?.name).toBe('Free weights');
  });

  it('every exercise without a station is listed in docs/v2/station-unresolved.md against 1,436', () => {
    const doc = read('docs/v2/station-unresolved.md');
    expect(doc).toContain(`Fixed denominator: **${SOURCE_TOTAL}**`);
    const stationless = exercises.filter((e) => e.stationId === undefined);
    const unlisted = stationless.filter((e) => !doc.includes(`\`${e.id}\``)).map((e) => e.id);
    expect(unlisted).toEqual([]);
    const out = buildCatalog(loadInputs());
    expect(out.stationless.map((u) => u.id)).toEqual(stationless.map((e) => e.id));
    expect(doc).toContain(`| **No station by design** (stretches + free-standing bodyweight) | **${out.stats.noStationByDesign}** |`);
    expect(doc).toContain(`| **Unresolved** (ambiguous machine moves) | **${out.stats.unresolved}** |`);
    expect(out.stats.noStationByDesign + out.stats.unresolved).toBe(stationless.length);
  });

  it('AC8: exercises with an unresolved station are ≤ 5 % of 1,436 (28 ambiguous machine moves = 1.9 %)', () => {
    // Stretches and free-standing bodyweight have no station by design (brief: "Stretches get the station
    // NONE"); every other station-less entry is unresolved, and today all of those are ambiguous machine moves.
    const out = buildCatalog(loadInputs());
    const unresolved = out.stationless.filter((u) => u.kind === 'unresolved');
    expect(unresolved.every((u) => u.category === 'ambiguous')).toBe(true);
    // 5 % of 1,436 = 71.8, so at most 71 entries
    expect(unresolved.length / SOURCE_TOTAL).toBeLessThanOrEqual(0.05);
    // 28 = the ambiguous bucket of docs/v2/station-unresolved.md (145 before F1 − 36 free weight − 25 frame − 37 stretch − 19 bodyweight)
    expect(unresolved).toHaveLength(28);
  });

  it('ratchet: exercises without a station never grow (81 of 1,436 = 5.6 %: 53 by design + 28 unresolved)', () => {
    // Regression ratchet on the total, lowered from 145 by the app-level stations (F1).
    // 81 = 145 − 36 FREE_WEIGHT − 28 FRAME (25 frame + 3 frame-bench)
    expect(exercises.filter((e) => e.stationId === undefined).length).toBeLessThanOrEqual(81);
  });

  it('ratchet (not an AC8 clause): the no-station-by-design count never grows (53 = 37 stretches + 16 free-standing bodyweight)', () => {
    // Honest ratchet: these have no station on purpose, so they do not count against AC8, but a rule change
    // that pushes more entries into this bucket must be seen. 16 = 19 bodyweight − 3 moved to FRAME by frame-bench.
    const out = buildCatalog(loadInputs());
    const byDesign = out.stationless.filter((u) => u.kind === 'by-design');
    expect(byDesign.every((u) => u.category === 'stretch' || u.category === 'bodyweight')).toBe(true);
    expect(byDesign.length).toBeLessThanOrEqual(53);
    // no station-less entry is a free weight or frame move any more: those have app-level stations
    expect(out.stationless.filter((u) => u.category === 'free-weight' || u.category === 'bodyweight-frame').map((u) => u.id)).toEqual([]);
  });

  it('time-measured sets: every exercise in all three chunks has measure "time" iff isTimeTarget(defaultReps)', async () => {
    const cat = await loadCatalog();
    const wrong = cat.exercises.filter((e) => (e.measure === 'time') !== isTimeTarget(e.defaultReps)).map((e) => `${e.id} (${e.defaultReps})`);
    expect(wrong).toEqual([]);
    // measure is only ever set to 'time'; undefined means 'reps'
    expect(cat.exercises.filter((e) => e.measure !== undefined && e.measure !== 'time').map((e) => e.id)).toEqual([]);
    const timed = (m: string) => cat.exercises.filter((e) => e.modality === m && e.measure === 'time').length;
    // 74 TYTAX = 41 × '30-60s' + 30 × '2-5 min' + 2 × '20-40s' + 1 × '15-30s hold'
    expect(timed('tytax')).toBe(74);
    // 12 bodyweight: 7 plain ranges ('20-60s', '10-30s' ×2, '20-45s' ×2, '5-20s', '30-60s') + 5 '/side' ranges
    expect(timed('bodyweight')).toBe(12);
    // 6 kettlebell, all '40s'
    expect(timed('kettlebell')).toBe(6);
    const doc = read('docs/v2/time-measured.md');
    // 92 = 74 + 12 + 6
    expect(doc).toContain('| **Total** | **92** |');
  });

  it('accounts for all 1,436 source entries: catalog + excluded non-exercises', () => {
    const out = buildCatalog(loadInputs());
    expect(out.stats.sourceTotal).toBe(SOURCE_TOTAL);
    // 1,409 exercises + 27 promo/delivery/overview videos = 1,436
    expect(out.stats.catalog + out.stats.excluded).toBe(SOURCE_TOTAL);
    expect(out.exercises).toHaveLength(exercises.length);
    // Every excluded entry is a video by source metadata: no exerciseLevel and T1-X number ≤ 13.
    const source = loadInputs().source;
    const bad = out.excluded.filter((x) => {
      const note = source.find((e) => e.name === x.name)?.note ?? '';
      return /exerciseLevel=/.test(note) || Number((/t1x_number=(\d+)/.exec(note) ?? [])[1]) > 13;
    });
    expect(bad.map((x) => x.name)).toEqual([]);
  });

  it('ids are unique and stable: every pre-v2 id is kept unless its entry is not an exercise', () => {
    const ids = exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const previous: string[] = JSON.parse(read(PREVIOUS_IDS_PATH));
    // 1,420 ids in the new_tytax build before v2
    expect(previous).toHaveLength(1420);
    const excludedIds = new Set(buildCatalog(loadInputs()).excluded.map((x) => x.id));
    const now = new Set(ids);
    expect(previous.filter((id) => !now.has(id) && !excludedIds.has(id))).toEqual([]);
  });

  it('the legacy-name map resolves every value and covers the original master list', () => {
    const ids = new Set(exercises.map((e) => e.id));
    const map = legacyNames as Record<string, string>;
    expect(Object.values(map).filter((id) => !ids.has(id))).toEqual([]);
    expect(map['TYTAX T1 | Smith Flat Bench Press']).toBe('tytax_smith-machine_smith-flat-bench-press');
    expect(map['Smith Flat Bench Press']).toBe('tytax_smith-machine_smith-flat-bench-press');
    const master = JSON.parse(read('scripts/data/source/tytax_library.json')).MASTER_EXERCISES as Array<{ name: string }>;
    // 118 master exercises in tytax_library.json
    expect(master).toHaveLength(118);
    expect(master.filter((m) => !map[m.name]).map((m) => m.name)).toEqual([]);
  });

  it('videos list app.tytax first, then YouTube', () => {
    const rank = (url: string) => (/app\.tytax\.com/.test(url) ? 0 : /youtube\.com|youtu\.be/.test(url) ? 1 : 2);
    const misordered = exercises.filter((e) => {
      const r = (e.videos ?? []).map((v) => rank(v.url));
      return r.some((x, i) => i > 0 && x < r[i - 1]);
    });
    expect(misordered.map((e) => e.id)).toEqual([]);
  });

  it('committed outputs equal a fresh deterministic build (npm run catalog:build -- --check)', () => {
    const previous = new Set<string>(JSON.parse(read(PREVIOUS_IDS_PATH)));
    const files = renderOutputs(buildCatalog(loadInputs()), previous);
    const again = renderOutputs(buildCatalog(loadInputs()), previous);
    expect(again).toEqual(files);
    const stale = Object.entries(files).filter(([rel, content]) => read(rel) !== content).map(([rel]) => rel);
    expect(stale).toEqual([]);
    expect(Object.keys(files)).toContain(OUTPUT_PATHS.exercises);
  });

  it('the catalog is lazy: exercise arrays are reachable only through the chunk loader', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(p);
        } else if (/\.(ts|tsx|mts|js|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk(resolve(ROOT, 'src'));
    const offenders = files.flatMap((f) => lazyViolations(f, readFileSync(f, 'utf8'))).map((v) => `${v.file.slice(ROOT.length + 1)} -> ${v.spec}`);
    expect(offenders).toEqual([]);
    // the scan saw the app: more than 100 source files
    expect(files.length).toBeGreaterThan(100);
  });

  it('the lazy-import scanner flags every way of pulling in an exercise array', () => {
    const ui = resolve(ROOT, 'src/app/(app)/x/page.tsx');
    const cases = [
      "import { TYTAX_EXERCISES } from '@/data/tytax';",
      "import { KB_EXERCISES } from '@/data/kettlebell/index';",
      "import x from '../../../data/tytax/exercises.json';",
      "export { BODYWEIGHT_EXERCISES } from '@/data/bodyweight/exercises';",
      "export * from '@/data/bodyweight/exercises';",
      "const d = require('@/data/tytax/exercises.json');",
      "const m = await import('@/data/kettlebell/exercises');",
      "/* hi */ import d from \"@/data/tytax/exercises.ts\";",
    ];
    for (const c of cases) expect(lazyViolations(ui, c)).toHaveLength(1);
    // allowed: presets and station metadata, and the chunk loader's dynamic imports
    expect(lazyViolations(ui, "import { ALL_PRESETS } from '@/data/tytax/presets';")).toEqual([]);
    expect(lazyViolations(resolve(ROOT, 'src/lib/catalog/chunks.ts'), "await import('@/data/tytax/exercises.json')")).toEqual([]);
  });
});

/** src/data/<modality>/exercises{,.json,.ts} or the modality barrel (index). */
const ARRAY_MODULE = /\/src\/data\/(tytax|bodyweight|kettlebell)(\/index(\.ts)?|\/exercises(\.json|\.ts)?)?$/;
const CHUNK_LOADER = resolve(ROOT, 'src/lib/catalog/chunks.ts');

/** Module specifiers in `file` that resolve to an exercise array, except the allowed edges. */
function lazyViolations(file: string, text: string): Array<{ file: string; spec: string }> {
  const out: Array<{ file: string; spec: string }> = [];
  const re = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(re)) {
    const spec = m[1];
    let target: string;
    if (spec.startsWith('@/')) target = resolve(ROOT, 'src', spec.slice(2));
    else if (spec.startsWith('.')) target = resolve(file, '..', spec);
    else continue;
    if (!ARRAY_MODULE.test(target)) continue;
    // The chunk loader may import(...) the arrays dynamically; exercises.ts may wrap its own JSON.
    if (file === CHUNK_LOADER && /\bimport\s*\(/.test(m[0])) continue;
    if (file === resolve(ROOT, 'src/data/tytax/exercises.ts') && target.endsWith('/tytax/exercises.json')) continue;
    out.push({ file, spec });
  }
  return out;
}
