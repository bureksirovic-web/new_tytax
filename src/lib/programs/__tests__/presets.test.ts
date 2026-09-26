import { describe, expect, it } from 'vitest';
import { ALL_PRESETS, DEFAULT_TYTAX_PRESET_ID, getPresetById, KB_PRESET_IDS } from '../presets';
import { loadCatalog } from '@/lib/catalog';

describe('built-in presets', () => {
  it('every preset has a unique stable presetId and no install-time fields', () => {
    const ids = ALL_PRESETS.map((p) => p.presetId);
    expect(ids).toEqual(['tytax-original-6day', 'tytax-elite-v3', 'bw-fundamentals', 'kb-simple-sinister', 'kb-hypertrophy', 'kb-conditioning']);
    // 6 presets, 6 distinct ids
    expect(new Set(ids).size).toBe(6);
    for (const p of ALL_PRESETS) {
      expect(Object.keys(p)).not.toContain('isActive');
      expect(Object.keys(p)).not.toContain('id');
      expect(Object.keys(p)).not.toContain('profileId');
      expect(p.isPreset).toBe(true);
    }
  });

  it('getPresetById resolves stable ids only', () => {
    expect(DEFAULT_TYTAX_PRESET_ID).toBe('tytax-original-6day');
    expect(getPresetById(DEFAULT_TYTAX_PRESET_ID)?.name).toBe('TYTAX 6-Day Split (Original)');
    expect(getPresetById('tytax-elite-v3')?.name).toBe('Tytax Elite v3.0');
    expect(getPresetById('kb-hypertrophy')?.modalitiesUsed).toEqual(['kettlebell']);
    expect(getPresetById('preset_tytax_elite_v3')).toBeUndefined();
    expect(KB_PRESET_IDS).toEqual(['kb-simple-sinister', 'kb-hypertrophy', 'kb-conditioning']);
  });

  it('the default TYTAX split is the original Upper/Lower A–C plus a flagged rest day', () => {
    const tytax = getPresetById(DEFAULT_TYTAX_PRESET_ID);
    // INITIAL_ORDER of tytax-autonomous (scripts/data/source/initial-plan.json)
    expect(tytax?.sessions.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C', 'Rest Day']);
    const rest = tytax?.sessions.at(-1);
    expect(rest?.isRest).toBe(true);
    expect(rest?.exercises).toEqual([]);
    expect(tytax?.sessions.filter((s) => s.isRest)).toHaveLength(1);
    // 6 + 5 + 6 + 5 + 6 + 5 = 33 exercises in INITIAL_PLAN
    expect(tytax?.sessions.flatMap((s) => s.exercises)).toHaveLength(33);
    expect(tytax?.sessions[0].exercises[0].exerciseId).toBe('tytax_smith-machine_smith-flat-bench-press');
  });

  it('Elite v3 keeps its own 6-day split with a rest day', () => {
    const elite = getPresetById('tytax-elite-v3');
    expect(elite?.sessions.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C', 'Rest']);
    expect(elite?.sessions.at(-1)?.isRest).toBe(true);
    expect(elite?.frequency).toBe(6);
  });

  it('every slot modality matches the preset modalities; every preset exercise id resolves', async () => {
    const cat = await loadCatalog();
    for (const p of ALL_PRESETS) {
      for (const s of p.sessions) {
        for (const ex of s.exercises) expect(p.modalitiesUsed).toContain(ex.modality);
      }
    }
    const unresolved = ALL_PRESETS.flatMap((p) => p.sessions.flatMap((s) => s.exercises)).filter((ex) => !cat.getById(ex.exerciseId));
    expect(unresolved.map((e) => e.exerciseId)).toEqual([]);
  });
});
