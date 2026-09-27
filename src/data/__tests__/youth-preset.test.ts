/**
 * Youth preset data test (family-profiles plan, AC5): "Calisthenics Start
 * (dip bars, youth)" (`bw-youth-dipbar-start`) is safe by construction —
 * 3 non-consecutive training days, small volume, technique-only TYTAX work
 * from a reviewed allow-list, and every exercise id resolves.
 */
import { describe, expect, it } from 'vitest';
import { getPresetById } from '@/lib/programs/presets';
import { loadCatalog } from '@/lib/catalog';
import { parseTarget } from '@/lib/training/targets';

const PRESET_ID = 'bw-youth-dipbar-start';

/**
 * Positive allow-list of TYTAX ids the youth preset may use (PLAN: "Light
 * TYTAX technique work ONLY from a positive allow-list"): upper-pulley
 * neutral/wide lat pulldown, lower-pulley seated cable row (bench),
 * upper-pulley face pull (rope), seated leg extension, seated leg curl.
 * Never the Smith machine, never a `tytax_tytax_*` catch-all id.
 */
const TYTAX_ALLOW_LIST: ReadonlySet<string> = new Set([
  'tytax_back-upper-pulley_upper-pulley-neutral-grip-lat-pulldown-v-handle',
  'tytax_back-upper-pulley_upper-pulley-wide-grip-lat-pulldown',
  'tytax_back-lower-pulley_lower-pulley-seated-cable-row-bench',
  'tytax_back-upper-pulley_upper-pulley-face-pull-rope',
  'tytax_leg-extension_seated-leg-extension',
  'tytax_leg-curl_seated-leg-curl',
]);

describe('youth preset: bw-youth-dipbar-start', () => {
  const preset = getPresetById(PRESET_ID);

  it('resolves and is a bodyweight+tytax full-body preset', () => {
    expect(preset).toBeDefined();
    expect(preset?.isPreset).toBe(true);
    expect(preset?.splitType).toBe('full_body');
  });

  it('exactly 3 training days; no two training slots adjacent in the 7-slot rotation, including the wrap', () => {
    const sessions = preset!.sessions;
    expect(sessions).toHaveLength(7);
    const training = sessions.filter((s) => !s.isRest);
    expect(training).toHaveLength(3);
    const n = sessions.length;
    for (let i = 0; i < n; i++) {
      const next = sessions[(i + 1) % n];
      if (!sessions[i].isRest) {
        expect(next.isRest).toBe(true);
      }
    }
  });

  it('every set count is 1-3', () => {
    const sets = preset!.sessions.flatMap((s) => s.exercises.map((ex) => ex.sets));
    expect(sets.length).toBeGreaterThan(0);
    for (const n of sets) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('every reps string parses through the shared target parser: reps 5-15, holds <= 30s', () => {
    const exercises = preset!.sessions.flatMap((s) => s.exercises);
    expect(exercises.length).toBeGreaterThan(0);
    for (const ex of exercises) {
      const target = parseTarget(ex.reps);
      expect(target, `${ex.exerciseId}: "${ex.reps}" did not parse`).not.toBeNull();
      if (!target) continue;
      if (target.unit === 'reps') {
        expect(target.min).toBeGreaterThanOrEqual(5);
        expect(target.max).toBeLessThanOrEqual(15);
      } else {
        expect(target.max).toBeLessThanOrEqual(30);
      }
    }
  });

  it('every TYTAX exercise is from the allow-list; never Smith, never tytax_tytax_*', () => {
    const tytax = preset!.sessions.flatMap((s) => s.exercises).filter((ex) => ex.modality === 'tytax');
    expect(tytax.length).toBeGreaterThan(0);
    for (const ex of tytax) {
      expect(TYTAX_ALLOW_LIST.has(ex.exerciseId)).toBe(true);
      expect(ex.exerciseId).not.toContain('smith');
      expect(ex.exerciseId.startsWith('tytax_tytax_')).toBe(false);
    }
  });

  it('every exercise id resolves in the catalog, with the exact catalog name', async () => {
    const cat = await loadCatalog();
    for (const ex of preset!.sessions.flatMap((s) => s.exercises)) {
      const found = cat.getById(ex.exerciseId);
      expect(found, `${ex.exerciseId} does not resolve`).toBeDefined();
      expect(found?.name).toBe(ex.exerciseName);
    }
  });

  it('registered in ALL_PRESETS with a stable, unique id', async () => {
    const { ALL_PRESETS } = await import('@/lib/programs/presets');
    expect(ALL_PRESETS.filter((p) => p.presetId === PRESET_ID)).toHaveLength(1);
  });
});
