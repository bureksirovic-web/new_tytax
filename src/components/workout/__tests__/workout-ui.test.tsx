import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { Exercise } from '@/contracts/domain';

const search = vi.fn<(q: { text?: string; limit?: number }) => Promise<Exercise[]>>();
vi.mock('@/lib/catalog', () => ({ catalog: { search: (q: { text?: string; limit?: number }) => search(q) } }));

import { NumberField } from '../number-field';

function Harness({ initial, zeroIsEmpty, max }: { initial: number | undefined; zeroIsEmpty?: boolean; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField
        value={value}
        onValueChange={setValue}
        label="field"
        testId="field"
        inputMode="decimal"
        step={0.25}
        max={max}
        zeroIsEmpty={zeroIsEmpty}
      />
      <output data-testid="stored">{value === undefined ? 'undef' : String(value)}</output>
      <button type="button" onClick={() => setValue(42)}>
        external
      </button>
    </>
  );
}

describe('NumberField', () => {
  it('shows 0 as empty when asked and pushes typed values', () => {
    render(<Harness initial={0} zeroIsEmpty />);
    const input = screen.getByTestId('field');
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: '62.5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('62.5');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('undef');
  });

  it('clamps to max and resyncs on external changes', () => {
    render(<Harness initial={undefined} max={5} />);
    const input = screen.getByTestId('field');
    fireEvent.change(input, { target: { value: '7' } });
    // 7 is above max 5 → stored 5, field shows 5.
    expect(screen.getByTestId('stored')).toHaveTextContent('5');
    expect(input).toHaveValue(5);
    fireEvent.click(screen.getByText('external'));
    expect(input).toHaveValue(42);
  });
});

// SessionExerciseCard: ported and extended in session-exercise-card.test.tsx.
