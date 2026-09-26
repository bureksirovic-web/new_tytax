import { describe, it, expect } from 'vitest';
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { orderByStation, stationChanges, stationRank, STATION_ORDER } from '../order-by-station';
import { ex, lookupOf } from './g3-helpers';

const se = (uid: string, exerciseId: string, supersetGroup?: string): SessionExercise => ({
  uid, exerciseId, exerciseName: exerciseId, modality: 'tytax', sets: [], ...(supersetGroup ? { supersetGroup } : {}),
});

const catalog: Exercise[] = [
  ex('smith-press', [], { station: 'Smith Machine' }),
  ex('smith-squat', [], { stationId: 'SMITH' }),
  ex('lat-pull', [], { station: 'Back Upper Pulley' }),
  ex('face-pull', [], { stationId: 'back-upper' }),
  ex('cable-row', [], { stationId: 'BACK_LOWER' }),
  ex('leg-ext', [], { stationId: 'leg-extension' }),
  ex('leg-curl', [], { station: 'Leg Curl' }),
  ex('pullup', [], { stationId: 'FRAME' }),
  ex('db-curl', [], { stationId: 'FREE_WEIGHT' }),
  ex('generic', [], { station: 'Tytax' }),
  ex('stretch', [], {}),
];
const lookup = lookupOf(catalog);
const uids = (list: SessionExercise[]) => list.map((e) => e.uid);

describe('stationRank', () => {
  it('normalises case, hyphens, spaces and the display-name aliases', () => {
    expect(STATION_ORDER).toEqual(['SMITH', 'BACK_UPPER', 'BACK_LOWER', 'LEG_EXTENSION', 'LEG_CURL', 'FRAME', 'FREE_WEIGHT']);
    expect(stationRank('smith')).toBe(0);
    expect(stationRank('Smith Machine')).toBe(0);
    expect(stationRank('back-upper')).toBe(1);
    expect(stationRank('Back Lower Pulley')).toBe(2);
    expect(stationRank('LEG_EXTENSION')).toBe(3);
    expect(stationRank('leg curl')).toBe(4);
    expect(stationRank('frame')).toBe(5);
    expect(stationRank('free weight')).toBe(6);
    expect(stationRank('tytax')).toBe(7);
    expect(stationRank(undefined)).toBe(7);
    expect(stationRank('')).toBe(7);
    expect(stationRank(' - ')).toBe(7);
  });
});

describe('orderByStation', () => {
  it('sorts by station rank and keeps the original order within a station (stable)', () => {
    const input = [
      se('a', 'stretch'), se('b', 'leg-curl'), se('c', 'smith-press'), se('d', 'lat-pull'), se('e', 'pullup'),
      se('f', 'smith-squat'), se('g', 'cable-row'), se('h', 'face-pull'), se('i', 'leg-ext'), se('j', 'db-curl'),
      se('k', 'unknown-id'), se('l', 'generic'),
    ];
    const out = orderByStation(input, lookup);
    // SMITH c,f → BACK_UPPER d,h → BACK_LOWER g → LEG_EXT i → LEG_CURL b → FRAME e → FREE_WEIGHT j
    // → unlisted TYTAX l → no station a (stretch), k (unknown id) in input order.
    expect(uids(out)).toEqual(['c', 'f', 'd', 'h', 'g', 'i', 'b', 'e', 'j', 'l', 'a', 'k']);
    expect(uids(input)[0]).toBe('a');
    expect(out).not.toBe(input);
  });

  it('moves superset members as one block at the first member’s station rank', () => {
    const input = [
      se('a', 'lat-pull'),
      se('b', 'leg-curl', 'A'),
      se('c', 'smith-press'),
      se('d', 'smith-squat', 'A'),
      se('e', 'cable-row'),
    ];
    // Group A (b,d) ranks as LEG_CURL (b's station). Ranked: c a e b d = SMITH,BU,BL,LC,SMITH → 4 changes.
    // Gathered input: a b d c e = BU,LC,SMITH,SMITH,BL → 3 changes. Input had 3 (BU,LC,SMITH,SMITH,BL).
    // The guard keeps the gathered order because ranking would add a re-rig.
    expect(stationChanges(input, lookup)).toBe(3);
    const out = orderByStation(input, lookup);
    expect(uids(out)).toEqual(['a', 'b', 'd', 'c', 'e']);
    expect(stationChanges(out, lookup)).toBe(3);
  });

  it('ranks a superset block when that does not add changes', () => {
    // x(BU) then group B y,z (SMITH,SMITH): ranked y z x = 1 change, gathered x y z = 1 change → ranked.
    const input = [se('x', 'lat-pull'), se('y', 'smith-press', 'B'), se('z', 'smith-squat', 'B')];
    expect(uids(orderByStation(input, lookup))).toEqual(['y', 'z', 'x']);
  });

  it('puts FREE_WEIGHT before exercises with no station', () => {
    const input = [se('s', 'stretch'), se('d', 'db-curl'), se('x', 'stretch')];
    // FREE_WEIGHT rank 6; stretches have no station and rank last.
    expect(uids(orderByStation(input, lookup))).toEqual(['d', 's', 'x']);
  });

  it('treats an empty, whitespace or null supersetGroup as no group', () => {
    const raw = (uid: string, exerciseId: string, supersetGroup: unknown): SessionExercise =>
      ({ ...se(uid, exerciseId), supersetGroup } as unknown as SessionExercise);
    // If ' ' were a group, p,r (BL,BU) would move as one block at BL: q p r. As no group: q(SMITH) r(BU) p(BL).
    expect(uids(orderByStation([raw('p', 'cable-row', ' '), se('q', 'smith-press'), raw('r', 'lat-pull', ' ')], lookup))).toEqual(['q', 'r', 'p']);
    expect(uids(orderByStation([raw('p', 'cable-row', ''), se('q', 'smith-press'), raw('r', 'lat-pull', '')], lookup))).toEqual(['q', 'r', 'p']);
    expect(uids(orderByStation([raw('p', 'cable-row', null), se('q', 'smith-press'), raw('r', 'lat-pull', null)], lookup))).toEqual(['q', 'r', 'p']);
  });

  it('keeps an already ordered list and handles an empty one', () => {
    const input = [se('a', 'smith-press'), se('b', 'lat-pull'), se('c', 'stretch')];
    expect(uids(orderByStation(input, lookup))).toEqual(['a', 'b', 'c']);
    expect(orderByStation([], lookup)).toEqual([]);
  });
});
