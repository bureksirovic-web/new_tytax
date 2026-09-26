import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import { STATION_ORDER, orderByStation, stationChanges } from '../order-by-station';

function ex(id: string, stationId?: string): Exercise {
  return {
    id,
    name: id,
    modality: stationId ? 'tytax' : 'bodyweight',
    stationId,
    muscleGroup: 'CHEST',
    pattern: '',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '8-12',
    impact: [],
  };
}

// One catalog exercise per station, plus two station-less ones and an unlisted station.
const CATALOG_LIST: Exercise[] = [
  ...STATION_ORDER.map((s) => ex(`x-${s}`, s)),
  ex('smith-2', 'SMITH'),
  ex('upper-2', 'BACK_UPPER'),
  ex('pushup'),
  ex('swing'),
  ex('rower', 'ROWER'),
];
const BY_ID = new Map(CATALOG_LIST.map((e) => [e.id, e]));
const catalog = { getById: (id: string) => BY_ID.get(id) };
const lookup = (id: string) => BY_ID.get(id);

interface Slot {
  exerciseId: string;
  supersetGroup?: string;
  tag: string;
}
const slot = (tag: string, exerciseId: string, supersetGroup?: string): Slot => ({ tag, exerciseId, supersetGroup });
const tags = (xs: readonly Slot[]) => xs.map((x) => x.tag);

const SMITH = 'x-SMITH';
const UPPER = 'x-BACK_UPPER';
const LOWER = 'x-BACK_LOWER';
const LEG_EXT = 'x-LEG_EXTENSION';

describe('stationChanges', () => {
  it('counts adjacent pairs on different stations; no-station is one value', () => {
    expect(stationChanges([], catalog)).toBe(0); // no pairs
    expect(stationChanges([slot('a', SMITH)], catalog)).toBe(0); // one exercise, no pairs
    // smith→smith 0, smith→upper 1, upper→pushup 1, pushup→swing 0 (both no station) = 2
    expect(stationChanges([slot('a', SMITH), slot('b', 'smith-2'), slot('c', UPPER), slot('d', 'pushup'), slot('e', 'swing')], catalog)).toBe(2);
    // unknown id and bodyweight share the no-station value: 0 changes
    expect(stationChanges([slot('a', 'ghost'), slot('b', 'pushup')], lookup)).toBe(0);
  });
});

describe('orderByStation', () => {
  it('groups by STATION_ORDER rank, keeps order within a rank ([lower, smith, upper, smith] → [smith, smith, upper, lower])', () => {
    const input = [slot('lower', LOWER), slot('smith1', SMITH), slot('upper', UPPER), slot('smith2', 'smith-2')];
    const out = orderByStation(input, catalog);
    expect(tags(out)).toEqual(['smith1', 'smith2', 'upper', 'lower']);
    // input: lower→smith, smith→upper, upper→smith = 3; output: smith→smith 0, smith→upper 1, upper→lower 1 = 2
    expect(stationChanges(input, catalog)).toBe(3);
    expect(stationChanges(out, catalog)).toBe(2);
  });

  it('puts station-less and unknown exercises last, unlisted stations after listed ones', () => {
    const input = [slot('pushup', 'pushup'), slot('rower', 'rower'), slot('ghost', 'ghost'), slot('legext', LEG_EXT), slot('smith', SMITH), slot('swing', 'swing')];
    // SMITH rank 0, LEG_EXTENSION rank 3, ROWER rank 7 (first unlisted), then pushup/ghost/swing in input order
    expect(tags(orderByStation(input, lookup))).toEqual(['smith', 'legext', 'rower', 'pushup', 'ghost', 'swing']);
  });

  it('is pure: returns a new array and leaves the input untouched', () => {
    const input = Object.freeze([slot('b', UPPER), slot('a', SMITH)]);
    const out = orderByStation(input, catalog);
    expect(out).not.toBe(input);
    expect(tags(input)).toEqual(['b', 'a']);
    expect(tags(out)).toEqual(['a', 'b']);
    expect(out[0]).toBe(input[1]); // same element objects, new array
    expect(orderByStation([], catalog)).toEqual([]);
  });

  it('places a superset block by its first member and never splits it', () => {
    // A = {A1 upper, A2 smith}; lone smiths S1, S2; lone lower L.
    const input = [slot('A1', UPPER, 'A'), slot('A2', SMITH, 'A'), slot('S1', 'smith-2'), slot('L', LOWER), slot('S2', SMITH)];
    // ranks by first member: A → upper 1, S1 → 0, L → 2, S2 → 0 ⇒ S1, S2, A1, A2, L
    const out = orderByStation(input, catalog);
    expect(tags(out)).toEqual(['S1', 'S2', 'A1', 'A2', 'L']);
    // input: upper→smith 1, smith→smith 0, smith→lower 1, lower→smith 1 = 3
    expect(stationChanges(input, catalog)).toBe(3);
    // output: smith→smith 0, smith→upper 1, upper→smith 1, smith→lower 1 = 3 (not worse, so the ranking stands)
    expect(stationChanges(out, catalog)).toBe(3);
  });

  it('keeps the input when ranking a cross-station superset would add a change', () => {
    // {A1 upper, A2 smith} before a lone smith S: ranking by the first member gives S, A1, A2
    const input = [slot('A1', UPPER, 'A'), slot('A2', SMITH, 'A'), slot('S', 'smith-2')];
    // ranked S, A1, A2: smith→upper 1 + upper→smith 1 = 2 > input upper→smith 1 + smith→smith 0 = 1 ⇒ guard keeps input
    expect(stationChanges(input, catalog)).toBe(1);
    expect(tags(orderByStation(input, catalog))).toEqual(['A1', 'A2', 'S']);
  });

  it('gathers non-adjacent superset members at the first member, in their internal order', () => {
    const input = [slot('A1', SMITH, 'A'), slot('U', UPPER), slot('A2', 'smith-2', 'A'), slot('B1', 'pushup', 'B'), slot('B2', LOWER, 'B')];
    // blocks: A (smith, rank 0) = [A1, A2]; U (rank 1); B (first member pushup → last) = [B1, B2]
    expect(tags(orderByStation(input, catalog))).toEqual(['A1', 'A2', 'U', 'B1', 'B2']);
    // an empty or blank supersetGroup is not a superset
    expect(tags(orderByStation([slot('x', UPPER, ''), slot('y', SMITH, ' ')], catalog))).toEqual(['y', 'x']);
  });
});

/** mulberry32: small deterministic PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = [...STATION_ORDER.map((s) => `x-${s}`), 'smith-2', 'upper-2', 'pushup', 'swing', 'rower', 'ghost'];

function randomSession(rand: () => number, withSupersets: boolean): Slot[] {
  const n = Math.floor(rand() * 13); // 0..12 exercises
  const out: Slot[] = [];
  let group = 0;
  while (out.length < n) {
    const size = withSupersets && rand() < 0.35 ? 2 + Math.floor(rand() * 2) : 1; // contiguous superset of 2–3
    const g = size > 1 ? String.fromCharCode(65 + group++) : undefined;
    for (let k = 0; k < size && out.length < n; k++) {
      out.push(slot(`s${out.length}`, POOL[Math.floor(rand() * POOL.length)], g));
    }
  }
  return out;
}

function distinctStations(xs: readonly Slot[]): number {
  return new Set(xs.map((x) => BY_ID.get(x.exerciseId)?.stationId ?? '∅')).size;
}

describe('orderByStation properties (seeded, 200 cases)', () => {
  it('never increases station changes; reaches distinct − 1 without supersets; keeps supersets whole', () => {
    const rand = mulberry32(20260927);
    let checked = 0;
    for (let c = 0; c < 200; c++) {
      const withSupersets = c % 2 === 1; // 100 cases each
      const input = randomSession(rand, withSupersets);
      const out = orderByStation(input, catalog);

      // permutation of the same slot objects
      expect([...out].sort((a, b) => a.tag.localeCompare(b.tag))).toEqual([...input].sort((a, b) => a.tag.localeCompare(b.tag)));
      expect(stationChanges(out, catalog)).toBeLessThanOrEqual(stationChanges(input, catalog));

      if (!withSupersets) {
        // every distinct station must be entered once, the first for free ⇒ minimum = distinct − 1 (0 for an empty session)
        expect(stationChanges(out, catalog)).toBe(Math.max(0, distinctStations(input) - 1));
      } else {
        for (const g of new Set(input.map((x) => x.supersetGroup).filter((x): x is string => x !== undefined))) {
          const inOrder = input.filter((x) => x.supersetGroup === g).map((x) => x.tag);
          const first = out.findIndex((x) => x.supersetGroup === g);
          // members sit next to each other, in their original internal order
          expect(tags(out.slice(first, first + inOrder.length))).toEqual(inOrder);
        }
      }
      checked++;
    }
    expect(checked).toBe(200); // 200 seeded cases ran
  });
});
