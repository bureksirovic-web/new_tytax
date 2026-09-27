/**
 * Youth prefill (family-profiles plan, PLAN §"Amendments after 1b" — youth
 * weight cap): `PrefillOptions.maxIncrementKg` caps the automatic increase,
 * and a youth profile never increases on a RIR-2 basis.
 *
 * Hand derivation (last session 20 kg, one working set):
 * - RIR 3: adult basis 'rir3plus' → +2.5 kg = 22.5 kg.
 *   Youth (`maxIncrementKg: 1.25`): 2.5 kg capped to 1.25 kg → 21.25 kg.
 * - RIR 2: adult basis 'rir2' → +1.25 kg = 21.25 kg.
 *   Youth: RIR-2 basis never increases → holds at 20 kg.
 * - RIR 3, `availableKg: [20, 22.5]`, youth: the capped target is 21.25 kg;
 *   the nearest available weight >= that is 22.5 kg, but 22.5 - 20 = 2.5 kg
 *   exceeds the 1.25 kg cap, so the weight holds at 20 kg instead of jumping.
 */
import { describe, expect, it } from 'vitest';
import { nextKg, prefillFromHistory } from '../prefill';
import { youthPrefillOptions } from '../youth';
import { logEndingAt } from './helpers';

const NOW = new Date('2026-09-27T10:00:00Z');
const PRESS = 'press';
const YOUTH_OPTS = youthPrefillOptions();

describe('prefillFromHistory: youth mode (maxIncrementKg)', () => {
  it('RIR 3+: adult 22.5 kg, youth 21.25 kg (2.5 kg capped to 1.25 kg)', () => {
    const log = logEndingAt(NOW, 48, [{ exerciseId: PRESS, sets: [{ kg: 20, reps: 8, rir: 3 }] }]);
    expect(prefillFromHistory(PRESS, [log]).suggestedKg).toBe(22.5);
    expect(prefillFromHistory(PRESS, [log], YOUTH_OPTS).suggestedKg).toBe(21.25);
  });

  it('RIR 2: adult 21.25 kg, youth holds at 20 kg (no increase at RIR 2)', () => {
    const log = logEndingAt(NOW, 48, [{ exerciseId: PRESS, sets: [{ kg: 20, reps: 8, rir: 2 }] }]);
    expect(prefillFromHistory(PRESS, [log]).suggestedKg).toBe(21.25);
    const youth = prefillFromHistory(PRESS, [log], YOUTH_OPTS);
    expect(youth.suggestedKg).toBe(20);
    expect(youth.sets.map((s) => s.kg)).toEqual([20]);
  });

  it('RIR 3+ with availableKg [20, 22.5]: a snap that would exceed the cap holds instead of jumping', () => {
    const log = logEndingAt(NOW, 48, [{ exerciseId: PRESS, sets: [{ kg: 20, reps: 8, rir: 3 }] }]);
    const r = prefillFromHistory(PRESS, [log], { ...YOUTH_OPTS, availableKg: [20, 22.5] });
    expect(r.suggestedKg).toBe(20);
  });
});

describe('nextKg: maxIncrementKg', () => {
  it('caps a plain increase', () => {
    expect(nextKg(20, 2.5, 'tytax', undefined, 1.25)).toBe(21.25);
  });

  it('holds when the nearest available weight would exceed the cap', () => {
    expect(nextKg(20, 2.5, 'tytax', [20, 22.5], 1.25)).toBe(20);
  });

  it('snaps normally when the nearest available weight is within the cap', () => {
    expect(nextKg(20, 1, 'tytax', [20, 21], 1.25)).toBe(21);
  });

  it('with no maxIncrementKg, behaves exactly as before', () => {
    expect(nextKg(20, 2.5, 'tytax')).toBe(22.5);
  });
});
