/**
 * AC8 data integrity (PLAN §10.2): presets resolve, stations are valid library
 * ids with provenance, unresolved entries are listed against the fixed
 * denominator of 1,436, and the committed catalog matches a fresh build.
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
import { buildCatalog } from '../../../scripts/data/catalog-lib';
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

  it('every station and attachment is a valid tytax_library.json id with a provenance', () => {
    // SMITH, BACK_UPPER, BACK_LOWER, LEG_EXTENSION, LEG_CURL
    expect([...STATION_KEYS].sort()).toEqual(['BACK_LOWER', 'BACK_UPPER', 'LEG_CURL', 'LEG_EXTENSION', 'SMITH']);
    const mapped = exercises.filter((e) => e.stationId !== undefined);
    expect(mapped.filter((e) => !STATION_KEYS.has(e.stationId as string)).map((e) => e.id)).toEqual([]);
    expect(exercises.flatMap((e) => e.attachmentIds ?? []).filter((a) => !ATTACHMENT_KEYS.has(a))).toEqual([]);
    const provenance = /^(t1x-meta|manual|name-rule:[a-z0-9-]+)$/;
    expect(mapped.filter((e) => !provenance.test(e.stationProvenance ?? '')).map((e) => e.id)).toEqual([]);
    // A station without provenance, or provenance without a station, is a build bug.
    expect(exercises.filter((e) => (e.stationId === undefined) !== (e.stationProvenance === undefined)).map((e) => e.id)).toEqual([]);
  });

  it('every exercise without a station is listed in docs/v2/station-unresolved.md against 1,436', () => {
    const doc = read('docs/v2/station-unresolved.md');
    expect(doc).toContain(`Fixed denominator: **${SOURCE_TOTAL}**`);
    const unresolved = exercises.filter((e) => e.stationId === undefined);
    const unlisted = unresolved.filter((e) => !doc.includes(`\`${e.id}\``)).map((e) => e.id);
    expect(unlisted).toEqual([]);
    // 140 of 1,436 = 9.7 %: above the 5 % target; the G1 report carries the finding and the proposed fix.
    expect(unresolved).toHaveLength(140);
    expect(doc).toContain(`| **Unresolved** (no station) | **${unresolved.length}** |`);
  });

  it('accounts for all 1,436 source entries: catalog + excluded non-exercises', () => {
    const out = buildCatalog(loadInputs());
    expect(out.stats.sourceTotal).toBe(SOURCE_TOTAL);
    // 1,404 exercises + 32 promo/delivery/overview videos = 1,436
    expect(out.stats.catalog + out.stats.excluded).toBe(SOURCE_TOTAL);
    expect(out.exercises).toHaveLength(exercises.length);
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

  it('the catalog is lazy: no static import of exercise data outside src/data and the chunk loader', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(p);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk(resolve(ROOT, 'src'));
    // `import x from '@/data/…/exercises…'` (static); `import('…')` inside src/lib/catalog is the lazy path
    const staticImport = /^\s*import\s[^;]*from\s+['"]@\/data\/(tytax|bodyweight|kettlebell)\/exercises(\.json)?['"]/m;
    const offenders = files
      .filter((f) => !f.includes(`${resolve(ROOT, 'src/data')}/`))
      .filter((f) => staticImport.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
    // the scan saw the app: more than 100 source files
    expect(files.length).toBeGreaterThan(100);
  });
});
