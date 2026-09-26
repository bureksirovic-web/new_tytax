/**
 * Import results are bounded for the UI.
 *
 * Regression: a 20 MiB legacy file holding one log with 511,441 invalid sets
 * gave previewLegacyImport 511,441 warnings (a 63 MiB result) and 166k
 * distinct exercise names gave 166k unresolved entries, all rendered by the
 * preview screen. Results now keep the first 200 warnings plus one summary
 * per omitted code, and the 200 most frequent unresolved names plus a count.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { importLegacy, previewLegacyImport } from '..';
import { MAX_REPORTED_UNRESOLVED, MAX_REPORTED_WARNINGS, capUnresolved, capWarnings } from '../service/cap';
import { syntheticResolver } from '../service/__fixtures__/testing';

const BAD_SETS = 5_000;
const NAMES = 450;

function hostileFile(): string {
  const set = '{"kg":1,"reps":1,"done":true,"type":"z"}';
  const bench = `{"name":"TYTAX T1 | Smith Flat Bench Press","sets":[${Array(BAD_SETS).fill(set).join(',')}]}`;
  const customs = Array.from({ length: NAMES }, (_, i) => `{"name":"Custom move ${i}","sets":[{"kg":1,"reps":1,"done":true}]}`);
  // "Custom move 7" appears twice, so it must survive the cap as one of the most frequent.
  customs.push('{"name":"Custom move 7","sets":[{"kg":2,"reps":1,"done":true}]}');
  return `{"logs":[{"id":1717243200000,"date":"2024-06-01","session":"A","exercises":[${bench},${customs.join(',')}]}]}`;
}

describe('legacy import results are capped', () => {
  it('previewLegacyImport keeps 200 warnings + a per-code summary and the top 200 unresolved names', async () => {
    const p = await previewLegacyImport(hostileFile(), { resolver: syntheticResolver() });
    const [user] = p.users;
    expect(user.sets).toBe(BAD_SETS + NAMES + 1);
    expect(user.warnings.length).toBeLessThanOrEqual(MAX_REPORTED_WARNINGS + 5);
    // One UNKNOWN_SET_TYPE parser warning per bad set: file-level list.
    expect(p.warnings.length).toBe(MAX_REPORTED_WARNINGS + 1);
    const summaries = p.warnings.filter((w) => w.path === '(omitted)');
    expect(summaries.length).toBeGreaterThan(0);
    const omitted = summaries.reduce((n, w) => n + Number(/^(\d+) more/.exec(w.message)?.[1]), 0);
    expect(MAX_REPORTED_WARNINGS + omitted).toBe(BAD_SETS);
    expect(user.unresolvedCount).toBe(NAMES);
    expect(user.unresolved).toHaveLength(MAX_REPORTED_UNRESOLVED);
    expect(user.unresolved.find((u) => u.legacyName === 'Custom move 7')?.occurrences).toBe(2);
    expect(JSON.stringify(p).length).toBeLessThan(200_000);
  });

  it('importLegacy returns capped lists but still imports every set and custom exercise', async () => {
    const { repo } = freshRepo();
    const r = await importLegacy(repo, hostileFile(), {
      users: [{ username: 'default', target: { createProfileName: 'a' } }],
      resolver: syntheticResolver(),
    });
    expect(r.warnings.length).toBeLessThanOrEqual(2 * MAX_REPORTED_WARNINGS + 5);
    expect(r.warnings.some((w) => w.path === '(omitted)')).toBe(true);
    expect(r.unresolvedCount).toBe(NAMES);
    expect(r.unresolved).toHaveLength(MAX_REPORTED_UNRESOLVED);
    const [log] = (await repo.exportBackup()).workoutLogs;
    expect(new Set(log.exercises.map((e) => e.exerciseName)).size).toBe(NAMES + 1);
  });

  it('capWarnings and capUnresolved leave short lists untouched', () => {
    const w = [{ code: 'INVALID_SET' as const, path: 'a', message: 'm' }];
    expect(capWarnings(w)).toEqual(w);
    const u = [{ legacyName: 'x', occurrences: 1 }];
    expect(capUnresolved(u)).toEqual(u);
    expect(capWarnings(Array(3).fill(w[0]), 1)).toEqual([w[0], { code: 'INVALID_SET', path: '(omitted)', message: '2 more INVALID_SET warning(s) not listed' }]);
  });
});
