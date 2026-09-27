import { describe, expect, it } from 'vitest';
import { csvHonorsUnits, loadCsvApi } from '../export-adapter';

describe('CSV units claim follows the CSV output (refuter1 suspect)', () => {
  it('matches the weight header the real module writes for lb, whatever else it exports', async () => {
    // kg-only module (v2-g4): false; G2's units-aware module (merged tree): true.
    const api = await loadCsvApi();
    expect(api.workouts).toBeTypeOf('function');
    const mod = (await import('@/lib/export/csv')) as unknown as Record<string, unknown>;
    const header = (mod.workoutLogsToCSV as (l: never[], o: { units: 'lb' }) => string)([], { units: 'lb' }).split('\n', 1)[0];
    const writesLb = header.split(',').includes('Weight (lb)');
    expect(writesLb || header.split(',').includes('Weight (kg)')).toBe(true);
    expect(api.unitsSupported).toBe(writesLb);
  });

  it('reads the header row the function actually produced', () => {
    expect(csvHonorsUnits((_l, o) => `Date,Weight (${o?.units ?? 'kg'})\n`)).toBe(true);
    expect(csvHonorsUnits(() => 'Date,Weight (kg)\n')).toBe(false);
    // a module that exports displayWeight but ignores opts is not believed
    expect(csvHonorsUnits(() => 'Date,Weight\n')).toBe(false);
    expect(csvHonorsUnits(() => { throw new Error('boom'); })).toBe(false);
    expect(csvHonorsUnits(undefined)).toBe(false);
  });
});
