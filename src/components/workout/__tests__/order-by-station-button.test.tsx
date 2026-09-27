import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OrderByStationButton } from '../order-by-station-button';

describe('OrderByStationButton', () => {
  it('is disabled with fewer than 2 exercises', () => {
    const onOrder = vi.fn(async () => true);
    const { rerender } = render(<OrderByStationButton count={1} onOrder={onOrder} />);
    expect(screen.getByTestId('order-by-station')).toBeDisabled();
    rerender(<OrderByStationButton count={2} onOrder={onOrder} />);
    expect(screen.getByTestId('order-by-station')).toBeEnabled();
    expect(screen.getByTestId('order-by-station')).toHaveAccessibleName('Order by station');
  });

  it.each([
    [true, 'Exercises reordered to minimise station changes.'],
    [false, 'Already in station order.'],
  ])('reordered=%s announces the outcome', async (changed, text) => {
    const onOrder = vi.fn(async () => changed);
    render(<OrderByStationButton count={3} onOrder={onOrder} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('order-by-station'));
    });
    expect(onOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(text);
    expect(screen.getByTestId('order-by-station')).toBeEnabled();
  });

  it('is busy (disabled) while ordering and reports a failure', async () => {
    let reject!: (e: Error) => void;
    const onOrder = vi.fn(() => new Promise<boolean>((_, r) => (reject = r)));
    render(<OrderByStationButton count={2} onOrder={onOrder} />);
    fireEvent.click(screen.getByTestId('order-by-station'));
    expect(screen.getByTestId('order-by-station')).toBeDisabled();
    await act(async () => reject(new Error('x')));
    expect(screen.getByRole('status')).toHaveTextContent('Could not reorder the exercises.');
    expect(screen.getByTestId('order-by-station')).toBeEnabled();
  });
});
