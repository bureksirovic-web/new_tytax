import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { PlateCalculator } from '../plate-calculator';

function setup(props: React.ComponentProps<typeof PlateCalculator> = {}) {
  render(
    <LocaleProvider>
      <PlateCalculator {...props} />
    </LocaleProvider>,
  );
  const target = screen.getByLabelText('Target weight (kg)');
  const bar = screen.getByLabelText('Bar weight (kg)');
  const plates = () => within(screen.getByTestId('plate-per-side')).queryAllByRole('listitem').map((li) => li.textContent);
  const loaded = () => screen.getByTestId('plate-loaded-total').textContent;
  return { target, bar, plates, loaded };
}

describe('PlateCalculator', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to 100 kg on a 20 kg bar -> 25, 15 per side', () => {
    const { target, bar, plates, loaded } = setup();
    expect(target).toHaveValue('100');
    expect(bar).toHaveValue('20');
    expect(plates()).toEqual(['25', '15']);
    expect(loaded()).toBe('100 kg');
  });

  it('typing 142,5 (comma decimal) loads 25, 25, 10, 1.25', () => {
    const { target, plates, loaded } = setup();
    fireEvent.change(target, { target: { value: '142,5' } });
    expect(plates()).toEqual(['25', '25', '10', '1.25']);
    expect(loaded()).toBe('142.5 kg');
    expect(screen.queryByTestId('plate-remainder')).not.toBeInTheDocument();
  });

  it('non-loadable target shows nearest lower and the remainder', () => {
    const { target, plates, loaded } = setup();
    fireEvent.change(target, { target: { value: '101' } });
    expect(plates()).toEqual(['25', '15']);
    expect(loaded()).toBe('100 kg');
    expect(screen.getByTestId('plate-remainder')).toHaveTextContent('1 kg');
  });

  it('custom bar weight changes the plates', () => {
    const { bar, plates, loaded } = setup();
    fireEvent.change(bar, { target: { value: '15' } });
    expect(plates()).toEqual(['25', '15', '2.5']);
    expect(loaded()).toBe('100 kg');
  });

  it('target equal to bar shows bar-only note', () => {
    const { target, plates, loaded } = setup();
    fireEvent.change(target, { target: { value: '20' } });
    expect(plates()).toEqual([]);
    expect(loaded()).toBe('20 kg');
    expect(screen.getByText('Bar only, no plates')).toBeInTheDocument();
  });

  it('target below bar shows an alert', () => {
    const { target, plates } = setup();
    fireEvent.change(target, { target: { value: '10' } });
    expect(plates()).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Target is lighter than the bar');
    expect(screen.queryByTestId('plate-remainder')).not.toBeInTheDocument();
  });

  it.each(['', '0', 'abc', '-5'])('invalid target %j shows validation and a dash', (value) => {
    const { target, plates, loaded } = setup();
    fireEvent.change(target, { target: { value } });
    expect(plates()).toEqual([]);
    expect(loaded()).toBe('—');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a weight greater than 0');
  });

  it.each(['1000.5', '99999999999'])('target %j above 1000 kg is rejected without crashing', (value) => {
    const { target, plates, loaded } = setup();
    fireEvent.change(target, { target: { value } });
    expect(plates()).toEqual([]);
    expect(loaded()).toBe('—');
    expect(screen.getByRole('alert')).toHaveTextContent('Maximum target is 1000 kg');
  });

  it('inputs meet the 44px touch target classes', () => {
    const { target, bar } = setup();
    expect(target).toHaveClass('min-h-11', 'min-w-11');
    expect(bar).toHaveClass('min-h-11', 'min-w-11');
  });

  it('renders Croatian labels when locale is hr', () => {
    localStorage.setItem('locale', 'hr');
    render(
      <LocaleProvider>
        <PlateCalculator />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText('Ciljna težina (kg)')).toHaveValue('100');
    expect(screen.getByLabelText('Težina šipke (kg)')).toHaveValue('20');
    expect(screen.getByText('Po strani')).toBeInTheDocument();
  });
});
