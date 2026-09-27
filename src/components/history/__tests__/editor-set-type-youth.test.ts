import { describe, expect, it } from 'vitest';
import { typeOptions } from '../editor-set-row';

describe('history editor set types in youth mode', () => {
  it('never offers drop or failure for a working/warm-up set', () => {
    expect(typeOptions('working', true)).toEqual(['working', 'warmup']);
    expect(typeOptions('warmup', true)).toEqual(['working', 'warmup']);
  });
  it('keeps a legacy drop/failure set showing only its own type, never the other forbidden one', () => {
    expect(typeOptions('drop', true)).toEqual(['working', 'warmup', 'drop']);
    expect(typeOptions('failure', true)).toEqual(['working', 'warmup', 'failure']);
  });
  it('adults get every type', () => {
    expect(typeOptions('working', false)).toEqual(['working', 'warmup', 'drop', 'failure']);
  });
});
