/**
 * Deterministic station/attachment rules for TYTAX exercises whose source
 * station is the generic "Tytax" (PLAN §10.2 AC8).
 *
 * Station ids are the `key`s of `tytax_library.json` STATIONS, plus two
 * app-level stations the library does not have (APP_STATIONS: FRAME,
 * FREE_WEIGHT; Wave 2 F1). Attachment ids are derived from
 * `tytax_library.json` RECOMMENDED_ATTACHMENTS names (see ATTACHMENT_IDS);
 * the library gives them no key of its own.
 *
 * First matching station rule wins; its id becomes the provenance
 * `name-rule:<id>`. Attachment rules are independent and all that match apply,
 * but only to pulley exercises (and the belt, which also serves the Smith).
 */

/** Station keys of `tytax_library.json` STATIONS. */
export type LibraryStationId = 'SMITH' | 'BACK_UPPER' | 'BACK_LOWER' | 'LEG_EXTENSION' | 'LEG_CURL';
/** App-level stations, not in `tytax_library.json` (Wave 2 F1). */
export type AppStationId = 'FRAME' | 'FREE_WEIGHT';
export type StationId = LibraryStationId | AppStationId;

export const LIBRARY_STATION_IDS: readonly LibraryStationId[] = ['SMITH', 'BACK_UPPER', 'BACK_LOWER', 'LEG_EXTENSION', 'LEG_CURL'];

/** Prefix of `Station.notes` that marks an app-level station in `src/data/tytax/library.json`. */
export const APP_LEVEL_NOTE_PREFIX = 'App-level addition (not in tytax_library.json)';

/** App-level stations appended to the library's STATIONS, in this order. */
export const APP_STATIONS: ReadonlyArray<{ id: AppStationId; name: string; notes: string }> = [
  { id: 'FRAME', name: 'Frame', notes: `${APP_LEVEL_NOTE_PREFIX}: bodyweight work on the T1-X frame (pull-up and dip handles, hanging, roman chair, the bench on the frame).` },
  { id: 'FREE_WEIGHT', name: 'Free weights', notes: `${APP_LEVEL_NOTE_PREFIX}: dumbbells, barbell and EZ bar used with the T1-X bench.` },
];

export const STATION_IDS: readonly StationId[] = [...LIBRARY_STATION_IDS, ...APP_STATIONS.map((s) => s.id)];

/** Short display names used in the app (the library names are longer). */
export const STATION_DISPLAY: Readonly<Record<StationId, string>> = {
  SMITH: 'Smith Machine',
  BACK_UPPER: 'Back Upper Pulley',
  BACK_LOWER: 'Back Lower Pulley',
  LEG_EXTENSION: 'Leg Extension',
  LEG_CURL: 'Leg Curl',
  FRAME: 'Frame',
  FREE_WEIGHT: 'Free weights',
};

/**
 * Name families of exercises no machine rule can place (lower-cased names).
 * The app-level station rules and `noStationCategory` (catalog-lib) share them.
 */
export const FREE_WEIGHT_NAME = /\b(dumbbell|barbell|ez bar)\b/;
export const STRETCH_NAME = /stretch|flexibility|\bsplit\b|twine|mobility/;
export const FRAME_NAME = /pull[- ]?up|chin[- ]?up|\bdips?\b|hanging|roman chair|hyperextension/;
export const BODYWEIGHT_NAME = /sit[- ]?up|push[- ]?up|\bplank\b|\bsquat\b|glute bridge|bridge|leg hip raise|bottoms up|pelvic/;
/** Bodyweight on the frame's bench: bench/incline/decline sit-ups and anything "with bench". */
export const FRAME_BENCH_NAME = /\b(bench|incline|decline)\b.*\bsit[- ]?ups?\b|\bwith bench\b/;

/** Source station strings with a specific station (provenance `t1x-meta`). */
export const SOURCE_STATION_MAP: Readonly<Record<string, StationId>> = {
  'Smith Machine': 'SMITH',
  'Back Upper Pulley': 'BACK_UPPER',
  'Back Lower Pulley': 'BACK_LOWER',
  'Leg Extension Seat': 'LEG_EXTENSION',
  'Leg Curl Seat': 'LEG_CURL',
};

/** RECOMMENDED_ATTACHMENTS name → id. */
export const ATTACHMENT_IDS: Readonly<Record<string, string>> = {
  'Pair of single D-handles': 'D_HANDLES',
  'Triceps rope': 'TRICEPS_ROPE',
  'Short straight bar (cable bar)': 'STRAIGHT_BAR',
  'V-handle / close-grip row handle': 'V_HANDLE',
  'Ankle strap': 'ANKLE_STRAP',
  'Ab strap (cable crunch strap)': 'AB_STRAP',
  'Lat bar (you already have)': 'LAT_BAR',
  'EZ/angled lat bar (you already have)': 'EZ_LAT_BAR',
  'Dip belt or strong assistance band': 'DIP_BELT',
};

export interface NameInfo {
  /** Lower-cased, whitespace-collapsed name. */
  name: string;
  /** Source pattern, lower-cased. */
  pattern: string;
  /** Source muscle group key, e.g. BACK_VERTICAL. */
  muscleGroup: string;
}

export interface StationRule {
  id: string;
  station: StationId;
  test: (n: NameInfo) => boolean;
  /** One-line rationale, printed in the docs. */
  why: string;
}

const has = (re: RegExp) => (n: NameInfo) => re.test(n.name);

const CABLE = /\b(cable|pulley|stirrups?)\b/;
const isCable = (n: NameInfo) => CABLE.test(n.name);
const LOW = /\b(low|lower)\b|low-to-high|from below/;
const HIGH = /\b(high|upper)\b|high-to-low|from above|overhead pulley/;
/** Muscle-region words ("upper chest", "lower back") are not pulley names. */
const REGION = /\b(upper|lower) (chest|back|body|abs|arms?|traps?|pecs?|lats?|glutes?)\b/g;
const pulleyWords = (n: NameInfo) => n.name.replace(REGION, ' ');
const SUPINE = /\b(lying|incline|decline|flat|supine|bench)\b/;
const SUPINE_MOVE = /\b(fly|flyes|butterfly|crossover|pullover)\b/;
/** 'reverse' blocks only a reverse FLY (a rear-delt move loaded from above), not a reverse GRIP. */
const NOT_SUPINE = /\b(prone|rear|standing|seated|high|upper|overhead)\b|\breverse (fly|flyes|butterfly)\b/;
const PULL_FROM_ABOVE = /pull ?down|push ?down|press ?down|pullover|face pull|crunch|woodchop|straight[- ]arm|\blat\b|poling/;

export const STATION_RULES: readonly StationRule[] = [
  { id: 'sled', station: 'SMITH', test: has(/\bs?led\b/), why: 'The T1-X "sled" is the Smith carriage (sled leg press, sled-assisted pull-ups/dips with belt).' },
  { id: 'smith', station: 'SMITH', test: has(/\bsmith\b/), why: 'Named after the Smith machine.' },
  { id: 'assisted-bodyweight', station: 'SMITH', test: has(/\bassisted\b.*\b(pull[- ]?ups?|chin[- ]?ups?|dips?)\b/), why: 'Assisted pull-ups/chin-ups/dips use the Smith carriage with a belt (library: "assisted pull-ups using the Smith bar setup").' },
  { id: 'belt', station: 'SMITH', test: (n) => /\bbelt\b/.test(n.name) && !isCable(n), why: 'Belt exercises hang the load from the Smith carriage.' },
  { id: 'ski-poling', station: 'BACK_UPPER', test: has(/\bpol{1,2}ing\b|\bski\b|ergo?nomet|\bnordic\b/), why: 'Ski-erg poling pulls handles down from the back-station upper pulleys.' },
  { id: 'leg-press', station: 'SMITH', test: has(/\bleg press\b/), why: 'On the T1-X the leg press is done on the Smith carriage.' },
  { id: 'leg-extension', station: 'LEG_EXTENSION', test: (n) => /\bleg extension\b/.test(n.name) && !/\blever\b/.test(n.name), why: 'Leg extension seat.' },
  { id: 'leg-curl-seat', station: 'LEG_CURL', test: (n) => /\bleg curl\b/.test(n.name) && !/\blever\b/.test(n.name) && !(isCable(n) && /\bstanding\b/.test(n.name)), why: 'Leg curl seat (standing cable curls use the lower pulley).' },
  { id: 'lever-from-above', station: 'BACK_UPPER', test: (n) => /\blever\b/.test(n.name) && PULL_FROM_ABOVE.test(n.name), why: 'Lever arm on the back station, loaded from the upper pulley (pulling down).' },
  { id: 'lever', station: 'BACK_LOWER', test: has(/\blever\b/), why: 'Lever arm on the back station, loaded from the lower pulley.' },
  { id: 'cable-pushdown', station: 'BACK_UPPER', test: (n) => isCable(n) && /push ?down|press ?down/.test(n.name), why: 'Pushdowns and pressdowns can only be loaded from the upper pulley.' },
  { id: 'cable-high', station: 'BACK_UPPER', test: (n) => isCable(n) && HIGH.test(pulleyWords(n)) && !LOW.test(pulleyWords(n)), why: 'High/upper pulley named (muscle regions like "upper chest" do not count).' },
  { id: 'cable-low', station: 'BACK_LOWER', test: (n) => isCable(n) && LOW.test(pulleyWords(n)), why: 'Low/lower pulley named (muscle regions like "lower chest" do not count).' },
  { id: 'cable-supine', station: 'BACK_LOWER', test: (n) => isCable(n) && SUPINE.test(n.name) && SUPINE_MOVE.test(n.name) && !NOT_SUPINE.test(n.name), why: 'Supine bench flies and pullovers are loaded from the floor pulleys beside or behind the bench.' },
  { id: 'cable-region-chest', station: 'BACK_LOWER', test: (n) => isCable(n) && /\bupper chest\b/.test(n.name) && /\b(fly|press)\b/.test(n.name), why: 'Upper-chest flies and presses move low-to-high, against the lower pulley.' },
  { id: 'cable-region-lower-chest', station: 'BACK_UPPER', test: (n) => isCable(n) && /\blower chest\b/.test(n.name) && /\b(fly|press)\b/.test(n.name), why: 'Lower-chest flies and presses move high-to-low, against the upper pulley.' },
  {
    id: 'pull-from-above',
    station: 'BACK_UPPER',
    test: (n) =>
      PULL_FROM_ABOVE.test(n.name) &&
      !/\b(sit[- ]?up|hanging|roman chair)\b/.test(n.name) &&
      // A row "with crunch" is still a row: the crunch is a trunk action, the load comes from the low anchor.
      !(/\brow\b/.test(n.name) && !/pull ?down|push ?down|press ?down|pullover|face pull/.test(n.name)) &&
      (isCable(n) || /pull ?down|push ?down|press ?down/.test(n.name)),
    why: 'Pulldowns, pushdowns, pressdowns, pullovers, face pulls, cable crunches and chops pull against the upper pulley (a row with a crunch stays a row).',
  },
  { id: 'cable-fly', station: 'BACK_UPPER', test: (n) => isCable(n) && /\b(fly|crossover|butterfly)\b/.test(n.name), why: 'Cable flies and crossovers default to the upper pulleys (low variants are caught by cable-low).' },
  { id: 'cable-overhead-extension', station: 'BACK_UPPER', test: (n) => isCable(n) && /\boverhead\b/.test(n.name) && /\bextension\b/.test(n.name), why: 'Overhead cable triceps extensions face away from the upper pulley.' },
  { id: 'cable-from-below', station: 'BACK_LOWER', test: (n) => isCable(n) && /\b(row|curl|raise|kick ?back|kick|abduction|adduction|pull[- ]through|shrug|deadlift|squat|upright|lunge|calf|wrist|press|glute|hip|bridge|twist|rotation|side bend|swing|reverse fly|extension)\b/.test(n.name), why: 'Rows, curls, raises, kickbacks, presses and hip work pull against the lower pulley.' },
  { id: 'cable-by-muscle', station: 'BACK_UPPER', test: (n) => isCable(n) && (n.muscleGroup === 'BACK_VERTICAL' || n.muscleGroup === 'TRICEPS' || n.muscleGroup === 'CORE'), why: 'Remaining cable work for lats, triceps and core uses the upper pulley.' },
  { id: 'cable-default', station: 'BACK_LOWER', test: isCable, why: 'Any other cable exercise: lower pulley.' },
  // App-level stations (Wave 2 F1). Last, so no exercise any machine rule places changes station.
  { id: 'free-weight', station: 'FREE_WEIGHT', test: has(FREE_WEIGHT_NAME), why: 'Dumbbell, barbell and EZ-bar work: free weights used with the T1-X bench (app-level station).' },
  {
    id: 'frame',
    station: 'FRAME',
    test: (n) => FRAME_NAME.test(n.name) && !STRETCH_NAME.test(n.name),
    why: 'Pull-ups, chin-ups, dips (bench dips included), hanging work, roman chair and hyperextensions use the frame (app-level station).',
  },
  {
    id: 'frame-bench',
    station: 'FRAME',
    test: (n) => FRAME_BENCH_NAME.test(n.name) && !STRETCH_NAME.test(n.name),
    why: 'Bench, incline and decline sit-ups and moves done "with bench" use the bench on the frame (app-level station).',
  },
];

export interface AttachmentRule {
  id: string;
  attachmentId: string;
  test: (n: NameInfo) => boolean;
}

export const ATTACHMENT_RULES: readonly AttachmentRule[] = [
  { id: 'd-handles', attachmentId: 'D_HANDLES', test: has(/stirrups?|d-handles?|(?<!v-)\bhandles?\b|\bseparate\b|\b(single|one)[- ]arm\b|\balternating\b/) },
  { id: 'rope', attachmentId: 'TRICEPS_ROPE', test: has(/\brope\b|face pull/) },
  { id: 'straight-bar', attachmentId: 'STRAIGHT_BAR', test: has(/straight[- ]bar|straight handle/) },
  { id: 'v-handle', attachmentId: 'V_HANDLE', test: has(/v-bar|v-handle|\bv bar\b|close[- ]grip (row|pull ?down|lat)|neutral[- ]grip|parallel grip/) },
  {
    id: 'ankle-strap',
    attachmentId: 'ANKLE_STRAP',
    test: (n) => /ankle|kick ?back|rear kick|hip (ab|ad)duction|leg raise|leg-hip raise|standing .*leg curl/.test(n.name) && !/\btriceps?\b/.test(n.name) && n.muscleGroup !== 'TRICEPS',
  },
  { id: 'ab-strap', attachmentId: 'AB_STRAP', test: (n) => /\bcrunch\b/.test(n.name) && !/\brope\b/.test(n.name) && !/\brow\b/.test(n.name) },
  {
    id: 'lat-bar',
    attachmentId: 'LAT_BAR',
    test: (n) =>
      /wide[- ]grip.*(pull ?down|lat)|lat pull ?down|behind the neck pull ?down|pulldown behind the neck/.test(n.name) &&
      !/\b(single|one)[- ]arm\b|stirrups?|\bseparate\b|v-handle|v-bar|neutral[- ]grip|close[- ]grip/.test(n.name),
  },
  { id: 'ez-lat-bar', attachmentId: 'EZ_LAT_BAR', test: (n) => /\b(ez|angled)\b/.test(n.name) && /pull ?down|curl|push ?down|extension/.test(n.name) },
  { id: 'belt', attachmentId: 'DIP_BELT', test: has(/\bbelt\b/) },
];

export interface StationDecision {
  stationId: StationId;
  ruleId: string;
}

export function normalizeName(raw: string): string {
  return raw.replace(/Â®/g, '®').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function nameInfo(name: string, pattern: string, muscleGroup: string): NameInfo {
  return { name: normalizeName(name), pattern: pattern.toLowerCase(), muscleGroup };
}

/** First matching station rule, or undefined when no rule applies. */
export function decideStation(n: NameInfo): StationDecision | undefined {
  for (const rule of STATION_RULES) {
    if (rule.test(n)) return { stationId: rule.station, ruleId: rule.id };
  }
  return undefined;
}

/** Attachments for an exercise on `stationId`, sorted, unique. */
export function decideAttachments(n: NameInfo, stationId: StationId | undefined): string[] {
  const out = new Set<string>();
  for (const rule of ATTACHMENT_RULES) {
    if (!rule.test(n)) continue;
    // Lever arms take no cable attachment; only the belt applies to them.
    const pulley = (stationId === 'BACK_UPPER' || stationId === 'BACK_LOWER') && !/\blever\b/.test(n.name);
    if (pulley || rule.attachmentId === 'DIP_BELT') out.add(rule.attachmentId);
  }
  return [...out].sort();
}

/**
 * Promo, delivery and overview videos in the source are not exercises. The
 * source metadata decides: a generic-station entry with no `exerciseLevel`
 * and a T1-X number of at most 13. (Real app exercises have T1-X numbers
 * above 13; most also carry an exerciseLevel, but 16 generic entries with
 * numbers 275–300 do not, so the number is what separates them.) These
 * labels only name the reason.
 */
export const NON_EXERCISE_LABELS: ReadonlyArray<{ id: string; test: RegExp; why: string }> = [
  { id: 'delivery', test: /^(delivery|deliverypromo)\b|^delivery ?#?\d/, why: 'Delivery video' },
  { id: 'factory', test: /^(factory\d*|packaging|laser\d*)$/, why: 'Factory/packaging video' },
  { id: 'promotion', test: /^promotion ?#?\d*$/, why: 'Promotion video' },
  { id: 'review', test: /\breview$/, why: 'Product review video' },
  { id: 'moving', test: /^moving tytax\b/, why: 'Moving-the-machine video' },
  { id: 'product-overview', test: /^tytax® (t1-x|tx)\b|^all about the tytax/, why: 'Product overview / option video' },
];

export function nonExerciseReason(name: string, note = '', station = 'Tytax'): { id: string; why: string } | undefined {
  const t1x = Number((/t1x_number=(\d+)/.exec(note) ?? [])[1]);
  const isVideo = station === 'Tytax' && !/exerciseLevel=/.test(note) && Number.isFinite(t1x) && t1x <= 13;
  if (!isVideo) return undefined;
  const n = normalizeName(name);
  const label = NON_EXERCISE_LABELS.find((r) => r.test.test(n));
  return label ? { id: label.id, why: label.why } : { id: 'video', why: 'Promo/overview video (no exerciseLevel, T1-X number ≤ 13)' };
}
