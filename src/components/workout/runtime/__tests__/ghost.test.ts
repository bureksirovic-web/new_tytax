import { describe, expect, it } from 'vitest';
import { beatsGhost } from '@/components/workout/runtime/ghost';

describe('beatsGhost', () => {
  it('is strictly greater', () => {
    expect(beatsGhost(9, 8)).toBe(true);
    expect(beatsGhost(8, 8)).toBe(false);
    expect(beatsGhost(7, 8)).toBe(false);
  });

  it('is false without a ghost or reps', () => {
    expect(beatsGhost(9, null)).toBe(false);
    expect(beatsGhost(null, 8)).toBe(false);
    expect(beatsGhost(undefined, undefined)).toBe(false);
    expect(beatsGhost(0, 0)).toBe(false);
    expect(beatsGhost(5, 0)).toBe(false);
  });
});
