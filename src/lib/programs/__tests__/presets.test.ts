import { describe, expect, it } from 'vitest';
import { ALL_PRESETS, DEFAULT_TYTAX_PRESET_ID, getPresetById, KB_PRESET_IDS } from '../presets';
import { loadCatalog } from '@/lib/catalog';

describe('built-in presets', () => {
  it('every preset has a unique stable presetId and no install-time fields', () => {
    const ids = ALL_PRESETS.map((p) => p.presetId);
    expect(ids).toEqual(['tytax-elite-v3', 'bw-fundamentals', 'kb-simple-sinister', 'kb-hypertrophy', 'kb-conditioning']);
    // 5 presets, 5 distinct ids
    expect(new Set(ids).size).toBe(5);
    for (const p of ALL_PRESETS) {
      expect(Object.keys(p)).not.toContain('isActive');
      expect(Object.keys(p)).not.toContain('id');
      expect(Object.keys(p)).not.toContain('profileId');
      expect(p.isPreset).toBe(true);
    }
  });

  it('getPresetById resolves stable ids only', () => {
    expect(DEFAULT_TYTAX_PRESET_ID).toBe('tytax-elite-v3');
    expect(getPresetById(DEFAULT_TYTAX_PRESET_ID)?.name).toBe('Tytax Elite v3.0');
    expect(getPresetById('kb-hypertrophy')?.modalitiesUsed).toEqual(['kettlebell']);
    expect(getPresetById('preset_tytax_elite_v3')).toBeUndefined();
    expect(KB_PRESET_IDS).toEqual(['kb-simple-sinister', 'kb-hypertrophy', 'kb-conditioning']);
  });

  it('the TYTAX split is Upper/Lower A–C plus a flagged rest day', () => {
    const tytax = getPresetById(DEFAULT_TYTAX_PRESET_ID);
    expect(tytax?.sessions.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C', 'Rest']);
    const rest = tytax?.sessions.at(-1);
    expect(rest?.isRest).toBe(true);
    expect(rest?.exercises).toEqual([]);
    expect(tytax?.sessions.filter((s) => s.isRest)).toHaveLength(1);
  });

  it('every slot modality matches the preset modalities; bodyweight and kettlebell ids resolve', async () => {
    const cat = await loadCatalog();
    for (const p of ALL_PRESETS) {
      for (const s of p.sessions) {
        for (const ex of s.exercises) expect(p.modalitiesUsed).toContain(ex.modality);
      }
    }
    const nonTytax = ALL_PRESETS.filter((p) => !p.modalitiesUsed.includes('tytax'));
    const unresolved = nonTytax.flatMap((p) => p.sessions.flatMap((s) => s.exercises)).filter((ex) => !cat.getById(ex.exerciseId));
    expect(unresolved.map((e) => e.exerciseId)).toEqual([]);
  });
});
