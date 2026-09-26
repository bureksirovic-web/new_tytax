/**
 * Deterministic station/attachment rules for TYTAX exercises whose source
 * station is the generic "Tytax" (PLAN §10.2 AC8).
 *
 * Station ids are the `key`s of `tytax_library.json` STATIONS. Attachment ids
 * are derived from `tytax_library.json` RECOMMENDED_ATTACHMENTS names
 * (see ATTACHMENT_IDS); the library gives them no key of its own.
 *
 * First matching station rule wins; its id becomes the provenance
 * `name-rule:<id>`. Attachment rules are independent and all that match apply,
 * but only to pulley exercises (and the belt, which also serves the Smith).
 */

export type StationId = 'SMITH' | 'BACK_UPPER' | 'BACK_LOWER' | 'LEG_EXTENSION' | 'LEG_CURL';

export const STATION_IDS: readonly StationId[] = ['SMITH', 'BACK_UPPER', 'BACK_LOWER', 'LEG_EXTENSION', 'LEG_CURL'];

/** Short display names used in the app (the library names are longer). */
export const STATION_DISPLAY: Readonly<Record<StationId, string>> = {
  SMITH: 'Smith Machine',
  BACK_UPPER: 'Back Upper Pulley',
  BACK_LOWER: 'Back Lower Pulley',
  LEG_EXTENSION: 'Leg Extension',
  LEG_CURL: 'Leg Curl',
};

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
  { id: 'cable-high', station: 'BACK_UPPER', test: (n) => isCable(n) && HIGH.test(n.name) && !LOW.test(n.name), why: 'High/upper pulley named.' },
  { id: 'cable-low', station: 'BACK_LOWER', test: (n) => isCable(n) && LOW.test(n.name), why: 'Low/lower pulley named.' },
  { id: 'pull-from-above', station: 'BACK_UPPER', test: (n) => PULL_FROM_ABOVE.test(n.name) && !/\b(sit[- ]?up|hanging|roman chair)\b/.test(n.name) && (isCable(n) || /pull ?down|push ?down|press ?down/.test(n.name)), why: 'Pulldowns, pushdowns, pressdowns, pullovers, face pulls, cable crunches and chops pull against the upper pulley.' },
  { id: 'cable-fly', station: 'BACK_UPPER', test: (n) => isCable(n) && /\b(fly|crossover|butterfly)\b/.test(n.name), why: 'Cable flies and crossovers default to the upper pulleys (low variants are caught by cable-low).' },
  { id: 'cable-overhead-extension', station: 'BACK_UPPER', test: (n) => isCable(n) && /\boverhead\b/.test(n.name) && /\bextension\b/.test(n.name), why: 'Overhead cable triceps extensions face away from the upper pulley.' },
  { id: 'cable-from-below', station: 'BACK_LOWER', test: (n) => isCable(n) && /\b(row|curl|raise|kick ?back|kick|abduction|adduction|pull[- ]through|shrug|deadlift|squat|upright|lunge|calf|wrist|press|glute|hip|bridge|twist|rotation|side bend|swing|reverse fly|extension)\b/.test(n.name), why: 'Rows, curls, raises, kickbacks, presses and hip work pull against the lower pulley.' },
  { id: 'cable-by-muscle', station: 'BACK_UPPER', test: (n) => isCable(n) && (n.muscleGroup === 'BACK_VERTICAL' || n.muscleGroup === 'TRICEPS' || n.muscleGroup === 'CORE'), why: 'Remaining cable work for lats, triceps and core uses the upper pulley.' },
  { id: 'cable-default', station: 'BACK_LOWER', test: isCable, why: 'Any other cable exercise: lower pulley.' },
];

export interface AttachmentRule {
  id: string;
  attachmentId: string;
  test: (n: NameInfo) => boolean;
}

export const ATTACHMENT_RULES: readonly AttachmentRule[] = [
  { id: 'd-handles', attachmentId: 'D_HANDLES', test: has(/stirrups?|d-handles?|\bhandles?\b|\b(single|one)[- ]arm\b|\balternating\b/) },
  { id: 'rope', attachmentId: 'TRICEPS_ROPE', test: has(/\brope\b|face pull/) },
  { id: 'straight-bar', attachmentId: 'STRAIGHT_BAR', test: has(/straight[- ]bar|straight handle/) },
  { id: 'v-handle', attachmentId: 'V_HANDLE', test: has(/v-bar|v-handle|\bv bar\b|close[- ]grip (row|pull ?down|lat)|neutral[- ]grip|parallel grip/) },
  { id: 'ankle-strap', attachmentId: 'ANKLE_STRAP', test: has(/ankle|kick ?back|rear kick|hip (ab|ad)duction|leg raise|leg-hip raise|standing .*leg curl/) },
  { id: 'ab-strap', attachmentId: 'AB_STRAP', test: (n) => /\bcrunch\b/.test(n.name) && !/\brope\b/.test(n.name) },
  { id: 'lat-bar', attachmentId: 'LAT_BAR', test: has(/wide[- ]grip.*(pull ?down|lat)|lat pull ?down|behind the neck pull ?down|pulldown behind the neck/) },
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

/** Promo, delivery and overview videos in the source that are not exercises. */
export const NON_EXERCISE_RULES: ReadonlyArray<{ id: string; test: RegExp; why: string }> = [
  { id: 'delivery', test: /^(delivery|deliverypromo)\b|^delivery ?#?\d/, why: 'Delivery video' },
  { id: 'factory', test: /^(factory\d*|packaging|laser\d*)$/, why: 'Factory/packaging video' },
  { id: 'promotion', test: /^promotion ?#?\d*$/, why: 'Promotion video' },
  { id: 'review', test: /\breview$/, why: 'Product review video' },
  { id: 'moving', test: /^moving tytax\b/, why: 'Moving-the-machine video' },
  { id: 'product-overview', test: /^tytax® (t1-x|tx)\b|^all about the tytax/, why: 'Product overview / option video' },
  { id: 'youtube-id', test: /^(?=.*\d)[a-z0-9_-]{11}$/, why: 'Name is a bare YouTube id' },
  { id: 'article', test: /\bvs\b.*\(|best way to|for fat loss|^abs workout$|^english$/, why: 'Article/overview, not an exercise' },
];

export function nonExerciseReason(name: string): { id: string; why: string } | undefined {
  const n = normalizeName(name);
  for (const r of NON_EXERCISE_RULES) {
    if (r.test.test(n)) return { id: r.id, why: r.why };
  }
  return undefined;
}
