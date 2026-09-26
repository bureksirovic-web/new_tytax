import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { RmCalculator } from '../rm-calculator';

function setup() {
  render(
    <LocaleProvider>
      <RmCalculator />
    </LocaleProvider>,
  );
  return {
    weight: screen.getByLabelText('Weight (kg)'),
    reps: screen.getByLabelText('Reps'),
    result: () => screen.getByTestId('rm-result').textContent,
  };
}

function tableValues(testId: string): string[] {
  return within(screen.getByTestId(testId))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent ?? '');
}

describe('RmCalculator', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to 100 x 5 -> 112.5', () => {
    const { weight, reps, result } = setup();
    expect(weight).toHaveValue('100');
    expect(reps).toHaveValue('5');
    expect(result()).toBe('112.5');
  });

  it('percent table for the default 1RM (112.51) is rounded to 2.5', () => {
    setup();
    // 1RM 112.511: 100% -> 112.5; 95% 106.89 -> 107.5; 90% 101.26 -> 102.5; 50% 56.26 -> 57.5
    const kg = tableValues('rm-percent-table');
    expect(kg).toHaveLength(11);
    expect(kg[0]).toBe('112.5');
    expect(kg[1]).toBe('107.5');
    expect(kg[2]).toBe('102.5');
    expect(kg[10]).toBe('57.5');
  });

  it('rep-max table has 12 rows and 5RM equals the entered weight', () => {
    setup();
    // inverse Brzycki of brzycki(100,5) at 5 reps = 100 exactly.
    const kg = tableValues('rm-rep-table');
    expect(kg).toHaveLength(12);
    expect(kg[4]).toBe('100');
  });

  it('typing 80 x 8 -> 99.5', () => {
    const { weight, reps, result } = setup();
    fireEvent.change(weight, { target: { value: '80' } });
    fireEvent.change(reps, { target: { value: '8' } });
    // 80 / 0.8054 = 99.33 -> 99.5
    expect(result()).toBe('99.5');
  });

  it('comma decimal weight 102,5 x 3 -> 108.5', () => {
    const { weight, reps, result } = setup();
    fireEvent.change(weight, { target: { value: '102,5' } });
    fireEvent.change(reps, { target: { value: '3' } });
    expect(result()).toBe('108.5');
  });

  it('1 rep returns the weight', () => {
    const { reps, result } = setup();
    fireEvent.change(reps, { target: { value: '1' } });
    expect(result()).toBe('100');
  });

  it.each([
    ['weight', ''],
    ['weight', '0'],
    ['reps', '0'],
    ['reps', '2.5'],
    ['reps', 'x'],
  ])('invalid %s %j shows validation and hides tables', (field, value) => {
    const els = setup();
    fireEvent.change(field === 'weight' ? els.weight : els.reps, { target: { value } });
    expect(els.result()).toBe('—');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter weight and reps greater than 0');
    expect(screen.queryByTestId('rm-percent-table')).not.toBeInTheDocument();
  });

  it('renders Croatian labels when locale is hr', () => {
    localStorage.setItem('locale', 'hr');
    render(
      <LocaleProvider>
        <RmCalculator />
      </LocaleProvider>,
    );
    expect(screen.getByLabelText('Težina (kg)')).toHaveValue('100');
    expect(screen.getByLabelText('Ponavljanja')).toHaveValue('5');
    expect(screen.getByText('Procijenjeni 1RM')).toBeInTheDocument();
  });

  it('more than 30 reps is rejected; 30 reps uses Epley', () => {
    const { reps, result } = setup();
    fireEvent.change(reps, { target: { value: '31' } });
    expect(result()).toBe('—');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at most 30 reps');
    expect(screen.queryByTestId('rm-percent-table')).not.toBeInTheDocument();
    // 100 * (1 + 30/30) = 200
    fireEvent.change(reps, { target: { value: '30' } });
    expect(result()).toBe('200');
  });
});
