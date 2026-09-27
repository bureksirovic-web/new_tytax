import { describe, expect, it } from 'vitest';
import { loadCatalog } from '@/lib/catalog';
import { ALL_PRESETS } from '@/lib/programs/presets';
import { REPS_MAX_LENGTH, isValidReps, normalizeReps } from '../session-edit';

describe('reps targets (refuter2 #3)', () => {
  it('accepts every distinct defaultReps of the catalog and every preset slot reps value', async () => {
    const cat = await loadCatalog();
    const values = new Set([
      ...cat.exercises.map((e) => e.defaultReps),
      ...ALL_PRESETS.flatMap((p) => p.sessions.flatMap((s) => s.exercises.map((e) => e.reps))),
    ]);
    expect(values.size).toBeGreaterThan(10);
    const rejected = [...values].filter((r) => !isValidReps(r));
    expect(rejected).toEqual([]);
    // Stored values survive a round trip unchanged (no silent rewrite of shipped data).
    expect([...values].filter((r) => normalizeReps(r) !== r.trim())).toEqual([]);
  });

  it('accepts the shipped free-text shapes verbatim', () => {
    for (const r of ['30-45s', '30s/side', '8-12/leg', '2-5 min', '8-12 (2s hold)', '15-30s hold', 'AMRAP']) {
      expect(normalizeReps(r)).toBe(r);
    }
  });

  it('normalises numeric ranges and trims', () => {
    expect(normalizeReps(' 8 - 12 ')).toBe('8-12');
    expect(normalizeReps('8 – 12 / side')).toBe('8-12/side');
    expect(normalizeReps('10/SIDE')).toBe('10/side');
    expect(normalizeReps('12')).toBe('12');
  });

  it('rejects empty, over-long, control characters and malformed numerics', () => {
    expect(normalizeReps('x'.repeat(REPS_MAX_LENGTH))).not.toBeNull();
    for (const r of ['', '  ', 'x'.repeat(REPS_MAX_LENGTH + 1), 'a\nb', 'a\tb', '8\u0007', '8-', '-8', '8--12', '8-12-']) {
      expect(normalizeReps(r)).toBeNull();
    }
  });
});
