/**
 * Regenerates the TYTAX exercise catalog deterministically (PLAN §10.2 AC8).
 *
 *   npm run catalog:build            write every output
 *   npm run catalog:build -- --check exit 1 when a committed output is stale
 *
 * Sources (vendored, read-only copies of tytax-autonomous @ f4a4733):
 *   scripts/data/source/full_exercises_final.js  1,436 exercises (canonical)
 *   scripts/data/source/tytax_library.json       stations, attachments, master list
 *   scripts/data/source/initial-plan.json        the original 6-day split
 * Hand inputs: scripts/data/{id-registry,station-manual,aliases}.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCatalog,
  type BuildInputs,
  type BuildOutput,
  type InitialPlan,
  type ManualMapping,
  type SourceExercise,
  type SourceLibrary,
} from './catalog-lib';
import { renderReconciliation, renderSample, renderTimeMeasured, renderUnresolved } from './catalog-docs';
import { BODYWEIGHT_EXERCISES } from '../../src/data/bodyweight/exercises';
import { KB_EXERCISES } from '../../src/data/kettlebell/exercises';

const ROOT = resolve(__dirname, '..', '..');
const p = (rel: string) => resolve(ROOT, rel);

export const OUTPUT_PATHS = {
  exercises: 'src/data/tytax/exercises.json',
  legacyNames: 'src/data/tytax/legacy-names.json',
  library: 'src/data/tytax/library.json',
  originalPlan: 'src/data/tytax/original-plan.json',
  idRegistry: 'scripts/data/id-registry.json',
  unresolvedDoc: 'docs/v2/station-unresolved.md',
  sampleDoc: 'docs/v2/station-sample.md',
  reconciliationDoc: 'docs/v2/catalog-reconciliation.md',
  timeMeasuredDoc: 'docs/v2/time-measured.md',
} as const;

function readJson<T>(rel: string, fallback: T): T {
  const file = p(rel);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}

/** `window.TYTAX_MAINFRAME = [...]` → the array. */
export function parseMainframe(js: string): SourceExercise[] {
  const start = js.indexOf('[');
  const end = js.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('full_exercises_final.js: no array literal found');
  const data: unknown = JSON.parse(js.slice(start, end + 1));
  if (!Array.isArray(data)) throw new Error('full_exercises_final.js: not an array');
  return data as SourceExercise[];
}

export function loadInputs(): BuildInputs {
  return {
    source: parseMainframe(readFileSync(p('scripts/data/source/full_exercises_final.js'), 'utf8')),
    library: readJson<SourceLibrary>('scripts/data/source/tytax_library.json', { MUSCLE_GROUPS: [], MASTER_EXERCISES: [], STATIONS: [], RECOMMENDED_ATTACHMENTS: [] }),
    plan: readJson<InitialPlan>('scripts/data/source/initial-plan.json', { INITIAL_PLAN: {}, INITIAL_ORDER: [] }),
    idRegistry: readJson<Record<string, string>>(OUTPUT_PATHS.idRegistry, {}),
    manual: readJson<Record<string, ManualMapping>>('scripts/data/station-manual.json', {}),
    aliases: readJson<Record<string, string>>('scripts/data/aliases.json', {}),
    displayNames: readJson<Record<string, { name: string; reason: string }>>('scripts/data/display-names.json', {}),
  };
}

/** Every output file's exact content. */
export function renderOutputs(out: BuildOutput, previousIds: ReadonlySet<string>): Record<string, string> {
  const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
  return {
    [OUTPUT_PATHS.exercises]: `${JSON.stringify(out.exercises)}\n`,
    [OUTPUT_PATHS.legacyNames]: json(out.legacyNames),
    [OUTPUT_PATHS.library]: json(out.library),
    [OUTPUT_PATHS.originalPlan]: json(out.originalPlan),
    [OUTPUT_PATHS.idRegistry]: json(out.idRegistry),
    [OUTPUT_PATHS.unresolvedDoc]: renderUnresolved(out),
    [OUTPUT_PATHS.sampleDoc]: renderSample(out),
    [OUTPUT_PATHS.reconciliationDoc]: renderReconciliation(out, previousIds),
    [OUTPUT_PATHS.timeMeasuredDoc]: renderTimeMeasured([
      { label: 'TYTAX', exercises: out.exercises },
      { label: 'Bodyweight', exercises: BODYWEIGHT_EXERCISES },
      { label: 'Kettlebell', exercises: KB_EXERCISES },
    ]),
  };
}

/** Ids of the pre-v2 new_tytax build (1,420 entries), for the reconciliation doc. */
export const PREVIOUS_IDS_PATH = 'scripts/data/previous-ids.json';

function main(): void {
  const check = process.argv.includes('--check');
  const inputs = loadInputs();
  const out = buildCatalog(inputs);
  const previous = new Set(readJson<string[]>(PREVIOUS_IDS_PATH, []));
  const files = renderOutputs(out, previous);
  const stale: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const file = p(rel);
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    if (check) stale.push(rel);
    else writeFileSync(file, content);
  }
  const s = out.stats;
  const pct = (n: number) => `${((n / s.sourceTotal) * 100).toFixed(1)}% of ${s.sourceTotal}`;
  const timed = out.exercises.filter((e) => e.measure === 'time').length;
  console.log(
    `catalog: source ${s.sourceTotal}, excluded ${s.excluded}, catalog ${s.catalog}, unresolved ${s.unresolved} (${pct(s.unresolved)}), ` +
      `no station by design ${s.noStationByDesign}, without station ${s.stationless} (${pct(s.stationless)}); ` +
      `provenance ${JSON.stringify(s.byProvenance)}; time-measured ${timed}`,
  );
  if (check && stale.length) {
    console.error(`stale outputs (run npm run catalog:build): ${stale.join(', ')}`);
    process.exit(1);
  }
  if (!check) console.log(`wrote ${Object.keys(files).length} outputs`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) main();
