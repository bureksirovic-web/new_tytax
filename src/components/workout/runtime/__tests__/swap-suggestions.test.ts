import { describe, expect, it } from 'vitest';
import { foldText, rankSwapCandidates } from '@/components/workout/runtime/swap-suggestions';

interface Ex {
  id: string;
  name: string;
  muscle?: string | null;
  pattern?: string | null;
  owned?: boolean;
}

const ex = (id: string, name: string, muscle: string | null, pattern: string | null, owned = true): Ex => ({
  id,
  name,
  muscle,
  pattern,
  owned,
});

const acc = {
  getId: (e: Ex) => e.id,
  getName: (e: Ex) => e.name,
  getMuscle: (e: Ex) => e.muscle,
  getPattern: (e: Ex) => e.pattern,
};

const target = ex('t', 'Bench Press', 'Chest', 'Horizontal Push');
const all: Ex[] = [
  target,
  ex('a', 'Push-up', 'Chest', 'Horizontal Push'),
  ex('b', 'Cable Fly', 'chest ', 'Fly'),
  ex('c', 'Dip', 'Triceps', 'horizontal push'),
  ex('d', 'Squat', 'Quads', 'Squat'),
  ex('e', 'Archer Push-up', 'Chest', 'Horizontal Push', false),
  ex('f', 'Čučanj s bučicom', 'Quads', 'Squat'),
  ex('g', 'Dumbbell Press', 'Chest', 'Horizontal Push'),
  ex('h', 'No-data', null, null),
];

const names = (list: Ex[]) => list.map((e) => e.name);

describe('foldText', () => {
  it('folds case, diacritics and whitespace', () => {
    expect(foldText('  Čučanj   ŠĐŽĆ  ')).toBe('cucanj sdzc');
    expect(foldText(null)).toBe('');
    expect(foldText('Straße Łódź Ø')).toBe('strasse lodz o');
  });
});

describe('rankSwapCandidates', () => {
  it('ranks both-match, then muscle, then pattern, then A-Z; excludes target and non-matches', () => {
    expect(names(rankSwapCandidates(target, all, acc))).toEqual([
      'Archer Push-up',
      'Dumbbell Press',
      'Push-up',
      'Cable Fly',
      'Dip',
    ]);
  });

  it('filters unavailable equipment when isAvailable is given', () => {
    const r = rankSwapCandidates(target, all, { ...acc, isAvailable: (e) => e.owned !== false });
    expect(names(r)).not.toContain('Archer Push-up');
    expect(names(r)[0]).toBe('Dumbbell Press');
  });

  it('applies limit', () => {
    expect(rankSwapCandidates(target, all, { ...acc, limit: 2 })).toHaveLength(2);
    expect(rankSwapCandidates(target, all, { ...acc, limit: 0 })).toEqual([]);
  });

  it('uses name search when the query is longer than 2 chars', () => {
    const r = rankSwapCandidates(target, all, { ...acc, query: 'cucanj' });
    expect(names(r)).toEqual(['Čučanj s bučicom']);
  });

  it('name search is case- and diacritic-insensitive and ignores muscle/pattern', () => {
    expect(names(rankSwapCandidates(target, all, { ...acc, query: 'SQUAT' }))).toEqual(['Squat']);
    expect(names(rankSwapCandidates(target, all, { ...acc, query: 'BUČ' }))).toEqual(['Čučanj s bučicom']);
  });

  it('name search puts prefix matches first, then A-Z, and excludes the target', () => {
    const r = rankSwapCandidates(target, all, { ...acc, query: 'push' });
    expect(names(r)).toEqual(['Push-up', 'Archer Push-up']);
    expect(names(rankSwapCandidates(target, all, { ...acc, query: 'bench' }))).toEqual([]);
  });

  it('name search respects availability and limit', () => {
    const r = rankSwapCandidates(target, all, {
      ...acc,
      query: 'push',
      isAvailable: (e) => e.owned !== false,
      limit: 5,
    });
    expect(names(r)).toEqual(['Push-up']);
  });

  it('short queries (<=2 chars after trimming) fall back to muscle/pattern', () => {
    expect(rankSwapCandidates(target, all, { ...acc, query: '  sq ' })).toHaveLength(5);
    expect(rankSwapCandidates(target, all, { ...acc, query: 'di' })).toHaveLength(5);
  });

  it('a target without muscle/pattern yields nothing (no empty-string matches)', () => {
    expect(rankSwapCandidates(all[8], all, acc)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const copy = [...all];
    rankSwapCandidates(target, all, acc);
    expect(all).toEqual(copy);
  });
});
