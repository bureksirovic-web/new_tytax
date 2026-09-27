import { describe, expect, it } from 'vitest';
import { lockedLegacyType, typeOptions } from '../editor-set-row';

describe('history editor set types in youth mode', () => {
  it('never offers drop or failure as a selectable choice', () => {
    expect(typeOptions(true)).toEqual(['working', 'warmup']);
  });
  it('shows a legacy drop/failure set as a disabled current value only', () => {
    expect(lockedLegacyType('drop', true)).toBe('drop');
    expect(lockedLegacyType('failure', true)).toBe('failure');
    expect(lockedLegacyType('working', true)).toBeNull();
    expect(lockedLegacyType('drop', false)).toBeNull();
  });
  it('adults get every type', () => {
    expect(typeOptions(false)).toEqual(['working', 'warmup', 'drop', 'failure']);
  });
});
