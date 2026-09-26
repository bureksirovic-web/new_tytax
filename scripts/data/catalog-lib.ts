/**
 * Pure catalog build: vendored tytax-autonomous sources → TYTAX catalog.
 * No I/O here; `build-catalog.ts` reads the sources and writes the outputs.
 */
import type { AttachmentDef, Exercise, MuscleImpact, ProgramTemplate, Station, StationProvenance, TechniqueLevel, Video } from '../../src/contracts/domain';
import { standardizeMuscle } from '../../src/lib/constants';
import {
  APP_STATIONS,
  ATTACHMENT_IDS,
  BODYWEIGHT_NAME,
  FRAME_NAME,
  FREE_WEIGHT_NAME,
  LIBRARY_STATION_IDS,
  SOURCE_STATION_MAP,
  STATION_DISPLAY,
  STRETCH_NAME,
  type StationId,
  decideAttachments,
  decideStation,
  nameInfo,
  nonExerciseReason,
  STATION_RULES,
} from './station-rules';

export interface SourceExercise {
  name: string;
  station: string;
  muscle_group: string;
  pattern: string;
  unilateral: boolean;
  sets: string | number;
  reps: string;
  impact: Array<{ m: string; s: number }>;
  note?: string;
  videos?: Video[];
}

export interface SourceLibrary {
  MUSCLE_GROUPS: unknown[];
  MASTER_EXERCISES: Array<{ name: string; station: string }>;
  STATIONS: Array<{ key: string; name: string; notes?: string }>;
  RECOMMENDED_ATTACHMENTS: Array<{ name: string; priority?: string; why?: string }>;
}

export interface InitialPlan {
  INITIAL_PLAN: Record<string, string[]>;
  INITIAL_ORDER: string[];
}

/** A reviewed hand decision for one source name. `stationId: null` = reviewed, stays unresolved. */
export interface ManualMapping {
  stationId: StationId | null;
  attachmentIds?: string[];
  reason: string;
}

export interface BuildInputs {
  source: SourceExercise[];
  library: SourceLibrary;
  plan: InitialPlan;
  /** source name → id, committed; new names are appended. */
  idRegistry: Record<string, string>;
  manual: Record<string, ManualMapping>;
  /** extra legacy name → source name. */
  aliases: Record<string, string>;
  /** source name → reviewed display name, for source entries whose name is not a usable title. */
  displayNames?: Record<string, { name: string; reason: string }>;
}

export interface ExcludedEntry {
  name: string;
  id: string;
  ruleId: string;
  why: string;
}

/** Name family of an exercise no machine rule places (the reason a library station is missing). */
export type NoStationCategory = 'free-weight' | 'bodyweight-frame' | 'bodyweight' | 'stretch' | 'ambiguous';

/**
 * `by-design`: stretches and free-standing bodyweight get no station (the brief: "Stretches get the
 * station NONE, i.e. no station"). `unresolved`: a station should exist but no rule or reviewed
 * mapping names it (ambiguous machine moves, or a reviewed `stationId: null` hand mapping).
 */
export type NoStationKind = 'by-design' | 'unresolved';

export interface StationlessEntry {
  name: string;
  id: string;
  pattern: string;
  muscleGroup: string;
  category: NoStationCategory;
  kind: NoStationKind;
  reason: string;
}

/** Name family, from the name alone (first match: free weight, stretch, frame, bodyweight). */
export function noStationCategory(name: string): NoStationCategory {
  const n = name.toLowerCase();
  if (FREE_WEIGHT_NAME.test(n)) return 'free-weight';
  if (STRETCH_NAME.test(n)) return 'stretch';
  if (FRAME_NAME.test(n)) return 'bodyweight-frame';
  if (BODYWEIGHT_NAME.test(n)) return 'bodyweight';
  return 'ambiguous';
}

/** Stretches and free-standing bodyweight have no station by design; anything else without one is unresolved. */
export function noStationKind(category: NoStationCategory, reviewedNull = false): NoStationKind {
  return !reviewedNull && (category === 'stretch' || category === 'bodyweight') ? 'by-design' : 'unresolved';
}

/** A number or range followed by a time unit, at the start of the target. No `g` flag: `test` stays stateless. */
export const TIME_TARGET = /^\s*\d+(\s*-\s*\d+)?\s*(s|sec|secs|seconds|min|mins|minutes)\b/i;

/**
 * True when a rep target is a pure time target: '20-40s', '30 sec', '1-2 min', '40s hold', '20-45s/side'.
 * Rep targets that only mention a pause ('8-12 (2s hold)') are not. Tags `Exercise.measure = 'time'`.
 */
export function isTimeTarget(defaultReps: string): boolean {
  return TIME_TARGET.test(defaultReps);
}

/** Equipment for station-less bodyweight exercises (contract `EquipmentRequirement`). */
function bodyweightEquipment(name: string, category: NoStationCategory): Exercise['requiresEquipment'] {
  const n = name.toLowerCase();
  // Machine-assisted T1-X stretches need the machine, not nothing.
  if (category === 'stretch' && /\bassisted\b|machine|\bsled\b|\blever\b/.test(n)) return ['tytax'];
  if (category === 'bodyweight-frame') return /\bdips?\b/.test(n) ? ['dip-station'] : /hyperextension|roman chair/.test(n) ? ['tytax'] : ['pull-up-bar'];
  if (category === 'bodyweight' || category === 'stretch') return ['none'];
  return undefined;
}

export interface BuildStats {
  sourceTotal: number;
  excluded: number;
  catalog: number;
  byProvenance: Record<string, number>;
  byRule: Record<string, number>;
  /** Catalog exercises without a station: `noStationByDesign + unresolved`. */
  stationless: number;
  /** Stretches and free-standing bodyweight (kind `by-design`). */
  noStationByDesign: number;
  /** Kind `unresolved`: a station should exist but none is named. */
  unresolved: number;
  genericInSource: number;
}

export interface BuildOutput {
  exercises: Exercise[];
  excluded: ExcludedEntry[];
  /** Every catalog exercise without a station, both kinds, in source order. */
  stationless: StationlessEntry[];
  legacyNames: Record<string, string>;
  library: { stations: Station[]; attachments: AttachmentDef[] };
  originalPlan: ProgramTemplate;
  idRegistry: Record<string, string>;
  stats: BuildStats;
}

export const ORIGINAL_PLAN_PRESET_ID = 'tytax-original-6day';

const LEGACY_PREFIX = 'TYTAX T1 | ';

/** Same cleaning the original app applies before matching names (index.html `cleanName`). */
export function cleanLegacyName(name: string): string {
  return name
    .replace(/TYTAX(Â®|®)?\s*(T1|T1-X|T3-X|T1-M)(-\d+)?\s*\|\s*/gi, '')
    .replace(/Instruction\s*\|\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** The id scheme of the original new_tytax build: station slug + name slug (60 chars), `_n` on collision. */
export function deriveIds(source: readonly SourceExercise[], registry: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = { ...registry };
  const used = new Set(Object.values(out));
  for (const e of source) {
    if (out[e.name]) continue;
    const station = e.station === 'Leg Extension Seat' ? 'Leg Extension' : e.station === 'Leg Curl Seat' ? 'Leg Curl' : e.station;
    const base = `tytax_${slugify(station)}_${slugify(e.name).slice(0, 60)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`;
    used.add(id);
    out[e.name] = id;
  }
  return out;
}

export function displayName(raw: string): string {
  return raw.replace(/Â®/g, '®').replace(/\s+/g, ' ').trim();
}

function parseNote(note: string | undefined): { t1xNumber?: number; techniqueLevel?: TechniqueLevel; note?: string } {
  if (!note) return {};
  let t1xNumber: number | undefined;
  let techniqueLevel: TechniqueLevel | undefined;
  const rest: string[] = [];
  for (const part of note.split(';').map((p) => p.trim()).filter(Boolean)) {
    const kv = /^([a-z0-9_]+)=(.*)$/i.exec(part);
    if (!kv) {
      rest.push(part);
      continue;
    }
    const [, key, value] = kv;
    if (key === 't1x_number' && /^\d+$/.test(value)) t1xNumber = Number(value);
    else if (key === 'exerciseLevel') techniqueLevel = value === 'easy' ? 'basic' : value === 'hard' ? 'advanced' : 'intermediate';
    // instructionLevel describes the video, not the exercise: dropped.
  }
  return { t1xNumber, techniqueLevel, note: rest.length ? rest.join('; ') : undefined };
}

function videoRank(url: string): number {
  if (/app\.tytax\.com/.test(url)) return 0;
  if (/youtube\.com|youtu\.be/.test(url)) return 1;
  return 2;
}

/** app.tytax first, then YouTube, then anything else; duplicates dropped; stable within a rank. */
export function orderVideos(videos: readonly Video[] | undefined): Video[] {
  const seen = new Set<string>();
  const unique = (videos ?? []).filter((v) => v && typeof v.url === 'string' && !seen.has(v.url) && seen.add(v.url));
  return unique
    .map((v, i) => ({ v, i, r: videoRank(v.url) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ v }) => ({ url: v.url, label: v.label }));
}

/** Standardised muscle names; duplicates merged at the higher score; order by score desc then name. */
export function standardImpact(impact: SourceExercise['impact']): MuscleImpact[] {
  const best = new Map<string, number>();
  for (const { m, s } of impact ?? []) {
    if (typeof m !== 'string' || typeof s !== 'number') continue;
    const muscle = standardizeMuscle(m);
    best.set(muscle, Math.max(best.get(muscle) ?? 0, s));
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([muscle, score]) => ({ muscle, score }));
}

interface StationResult {
  stationId?: StationId;
  attachmentIds: string[];
  provenance?: StationProvenance;
  ruleId?: string;
  unresolvedReason?: string;
  /** A reviewed hand mapping said `stationId: null`. */
  reviewedNull?: boolean;
}

function resolveStation(e: SourceExercise, manual: Readonly<Record<string, ManualMapping>>): StationResult {
  const info = nameInfo(e.name, e.pattern, e.muscle_group);
  const fromSource = SOURCE_STATION_MAP[e.station];
  if (fromSource) {
    return { stationId: fromSource, attachmentIds: decideAttachments(info, fromSource), provenance: 't1x-meta', ruleId: 't1x-meta' };
  }
  const hand = manual[e.name];
  if (hand) {
    if (hand.stationId === null) return { attachmentIds: [], unresolvedReason: hand.reason, reviewedNull: true };
    const attachmentIds = [...new Set(hand.attachmentIds ?? decideAttachments(info, hand.stationId))].sort();
    return { stationId: hand.stationId, attachmentIds, provenance: 'manual', ruleId: 'manual' };
  }
  const rule = decideStation(info);
  if (rule) {
    return {
      stationId: rule.stationId,
      attachmentIds: decideAttachments(info, rule.stationId),
      provenance: `name-rule:${rule.ruleId}`,
      ruleId: rule.ruleId,
    };
  }
  return { attachmentIds: [], unresolvedReason: 'No rule or reviewed mapping names a T1-X station' };
}

function toExercise(e: SourceExercise, id: string, st: StationResult, legacyName: string): Exercise {
  const { t1xNumber, techniqueLevel, note } = parseNote(e.note);
  // Frame exercises keep their gear (pull-up bar, dip station) for the equipment filter; machine stations need none.
  const gear = !st.stationId || st.stationId === 'FRAME' ? bodyweightEquipment(e.name, noStationCategory(e.name)) : undefined;
  // On the frame "no equipment" still means the machine's bench.
  const requiresEquipment = st.stationId === 'FRAME' && gear?.[0] === 'none' ? (['tytax'] as Exercise['requiresEquipment']) : gear;
  const defaultReps = String(e.reps ?? '8-12');
  const sets = Number.parseInt(String(e.sets), 10);
  const videos = orderVideos(e.videos);
  const ex: Exercise = {
    id,
    name: displayName(e.name),
    modality: 'tytax',
    ...(st.stationId ? { station: STATION_DISPLAY[st.stationId], stationId: st.stationId } : {}),
    ...(st.attachmentIds.length ? { attachmentIds: st.attachmentIds } : {}),
    ...(st.provenance ? { stationProvenance: st.provenance } : {}),
    ...(t1xNumber !== undefined ? { t1xNumber } : {}),
    legacyName,
    muscleGroup: e.muscle_group as Exercise['muscleGroup'],
    pattern: e.pattern,
    isUnilateral: Boolean(e.unilateral),
    defaultSets: Number.isFinite(sets) && sets > 0 ? sets : 3,
    defaultReps,
    impact: standardImpact(e.impact),
    ...(isTimeTarget(defaultReps) ? { measure: 'time' as const } : {}),
    ...(techniqueLevel ? { techniqueLevel } : {}),
    ...(requiresEquipment ? { requiresEquipment } : {}),
    tags: [],
    ...(videos.length ? { videos } : {}),
    ...(note ? { note } : {}),
  };
  return ex;
}

function sortedRecord(r: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function buildCatalog(inputs: BuildInputs): BuildOutput {
  const { source, library, plan, manual, aliases } = inputs;
  const idRegistry = deriveIds(source, inputs.idRegistry);

  // Legacy names: the master list uses "TYTAX T1 | <name>"; logs store that form.
  const masterByClean = new Map<string, string>();
  for (const m of library.MASTER_EXERCISES) masterByClean.set(cleanLegacyName(m.name).toLowerCase(), m.name);

  const exercises: Exercise[] = [];
  const excluded: ExcludedEntry[] = [];
  const stationless: StationlessEntry[] = [];
  const legacyNames: Record<string, string> = {};
  const byProvenance: Record<string, number> = {};
  const byRule: Record<string, number> = {};

  for (const e of source) {
    const id = idRegistry[e.name];
    const non = nonExerciseReason(e.name, e.note ?? '', e.station);
    if (non) {
      excluded.push({ name: e.name, id, ruleId: non.id, why: non.why });
      continue;
    }
    const st = resolveStation(e, manual);
    const master = masterByClean.get(cleanLegacyName(e.name).toLowerCase());
    const legacyName = master ?? e.name;
    const ex = toExercise(e, id, st, legacyName);
    const override = inputs.displayNames?.[e.name];
    if (override) {
      ex.name = override.name;
      legacyNames[override.name] = id;
    }
    exercises.push(ex);
    legacyNames[e.name] = id;
    legacyNames[displayName(e.name)] = id;
    if (master) legacyNames[master] = id;
    if (st.provenance) {
      const key = st.provenance.startsWith('name-rule:') ? 'name-rule' : st.provenance;
      byProvenance[key] = (byProvenance[key] ?? 0) + 1;
      if (st.ruleId) byRule[st.ruleId] = (byRule[st.ruleId] ?? 0) + 1;
    } else {
      const category = noStationCategory(e.name);
      const kind = noStationKind(category, st.reviewedNull);
      stationless.push({
        name: displayName(e.name),
        id,
        pattern: e.pattern,
        muscleGroup: e.muscle_group,
        category,
        kind,
        reason: kind === 'by-design' ? 'Stretch or free-standing bodyweight: no station by design' : st.unresolvedReason ?? '',
      });
    }
  }

  const idBySourceName = new Map(source.map((e) => [e.name.toLowerCase(), idRegistry[e.name]]));
  for (const [legacy, target] of Object.entries(aliases)) {
    const id = idBySourceName.get(target.toLowerCase());
    if (!id) throw new Error(`alias "${legacy}" targets unknown source name "${target}"`);
    legacyNames[legacy] = id;
  }

  const byId = new Map(exercises.map((x) => [x.id, x]));
  const resolveLegacy = (name: string): Exercise => {
    const id = legacyNames[name] ?? idBySourceName.get(cleanLegacyName(name).toLowerCase());
    const ex = id ? byId.get(id) : undefined;
    if (!ex) throw new Error(`INITIAL_PLAN exercise "${name}" does not resolve to a catalog exercise`);
    return ex;
  };

  const sessions = plan.INITIAL_ORDER.map((sessionName, dayIndex) => {
    const names = plan.INITIAL_PLAN[sessionName] ?? [];
    return {
      id: `${ORIGINAL_PLAN_PRESET_ID}-${slugify(sessionName)}`,
      programId: '',
      name: sessionName,
      dayIndex,
      ...(names.length === 0 ? { isRest: true } : {}),
      exercises: names.map((n) => {
        const ex = resolveLegacy(n);
        return {
          exerciseId: ex.id,
          exerciseName: ex.name,
          modality: 'tytax' as const,
          sets: ex.defaultSets,
          reps: ex.defaultReps,
          restSeconds: ex.pattern === 'Squat' || ex.pattern === 'Hinge' || ex.muscleGroup === 'QUADS' ? 150 : 90,
        };
      }),
    };
  });
  const originalPlan: ProgramTemplate = {
    name: 'TYTAX 6-Day Split (Original)',
    splitType: 'upper_lower',
    frequency: 6,
    periodizationType: 'none',
    sessionOrder: [...plan.INITIAL_ORDER],
    sessions,
    modalitiesUsed: ['tytax'],
    isPreset: true,
    presetId: ORIGINAL_PLAN_PRESET_ID,
    currentSessionIndex: 0,
  };

  const stations: Station[] = library.STATIONS.map((s) => ({ id: s.key, name: STATION_DISPLAY[s.key as StationId] ?? s.name, notes: s.notes }));
  for (const id of LIBRARY_STATION_IDS) {
    if (!stations.some((s) => s.id === id)) throw new Error(`station ${id} missing from tytax_library.json STATIONS`);
  }
  for (const app of APP_STATIONS) {
    if (stations.some((s) => s.id === app.id)) throw new Error(`app-level station ${app.id} now exists in tytax_library.json STATIONS`);
    stations.push({ id: app.id, name: app.name, notes: app.notes });
  }
  const attachments: AttachmentDef[] = library.RECOMMENDED_ATTACHMENTS.map((a) => {
    const id = ATTACHMENT_IDS[a.name];
    if (!id) throw new Error(`attachment "${a.name}" has no id in ATTACHMENT_IDS`);
    return { id, name: a.name.replace(/\s*\(you already have\)/, ''), priority: a.priority, why: a.why };
  });

  return {
    exercises,
    excluded,
    stationless,
    legacyNames: sortedRecord(legacyNames),
    library: { stations, attachments },
    originalPlan,
    idRegistry: sortedRecord(idRegistry),
    stats: {
      sourceTotal: source.length,
      excluded: excluded.length,
      catalog: exercises.length,
      byProvenance,
      byRule,
      stationless: stationless.length,
      noStationByDesign: stationless.filter((u) => u.kind === 'by-design').length,
      unresolved: stationless.filter((u) => u.kind === 'unresolved').length,
      genericInSource: source.filter((e) => e.station === 'Tytax').length,
    },
  };
}

/** Rule rationale lines for the docs. */
export function ruleDocs(): Array<{ id: string; station: StationId; why: string }> {
  return STATION_RULES.map((r) => ({ id: r.id, station: r.station, why: r.why }));
}

/** mulberry32: small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` items drawn without replacement with a seeded Fisher–Yates over `items` sorted by id. */
export function seededSample<T extends { id: string }>(items: readonly T[], count: number, seed: number): T[] {
  const pool = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rand = mulberry32(seed);
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export { LEGACY_PREFIX };
