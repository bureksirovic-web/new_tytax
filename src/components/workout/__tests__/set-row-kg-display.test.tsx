/**
 * Refuter R2 (2026-09-27): a weight entered in lb (stored unrounded in kg)
 * showed as 61.235042773811365 in the kg field once the profile unit was kg.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { SetEntry } from '@/contracts/domain';
import { displayToKg } from '@/lib/utils';
import { SetRow } from '../set-row';

afterEach(() => cleanup());

function Harness({ initial, onPatch = vi.fn() }: { initial: SetEntry; onPatch?: (p: Partial<SetEntry>) => void }) {
  const [set, setSet] = useState(initial);
  return (
    <ul>
      <SetRow
        set={set}
        number={1}
        modality="tytax"
        units="kg"
        onChange={(p) => {
          onPatch(p);
          setSet((s) => ({ ...s, ...p }));
        }}
        onToggleDone={vi.fn()}
        onRemove={vi.fn()}
      />
    </ul>
  );
}

describe('kg field of a set entered in lb', () => {
  it('shows the stored kg rounded to 0.01, not a raw float', () => {
    render(<Harness initial={{ id: 's1', type: 'working', kg: displayToKg(135, 'lb'), reps: 5, done: false }} />);
    expect(screen.getByTestId('set-kg')).toHaveValue('61.24');
  });

  it('keeps what the user types in kg, up to three decimals, while the display rounds', () => {
    const onPatch = vi.fn();
    render(<Harness initial={{ id: 's1', type: 'working', kg: 0, reps: 5, done: false }} onPatch={onPatch} />);
    const kg = screen.getByTestId('set-kg');
    fireEvent.change(kg, { target: { value: '61.25' } });
    expect(kg).toHaveValue('61.25');
    fireEvent.change(kg, { target: { value: '61.255' } });
    expect(kg).toHaveValue('61.255');
    expect(onPatch).toHaveBeenLastCalledWith({ kg: 61.255 });
  });
});
