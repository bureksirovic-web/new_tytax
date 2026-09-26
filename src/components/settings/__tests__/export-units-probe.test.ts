import { describe, expect, it } from 'vitest';
import { csvHonorsUnits, loadCsvApi } from '../export-adapter';

describe('CSV units claim follows the CSV output (refuter1 suspect)', () => {
  it('is false for the current kg-only module, whatever else it exports', async () => {
    const api = await loadCsvApi();
    expect(api.workouts).toBeTypeOf('function');
    expect(api.unitsSupported).toBe(false);
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
