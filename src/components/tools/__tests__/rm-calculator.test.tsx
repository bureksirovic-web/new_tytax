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

  it('percent table for the default 1RM (112.5) is rounded to 2.5', () => {
    setup();
    // 1RM 3600/32 = 112.5: 100% -> 112.5; 95% 106.875 -> 42.75 -> 107.5; 90% 101.25 -> 40.5 -> 102.5; 50% 56.25 -> 22.5 -> 57.5
    const kg = tableValues('rm-percent-table');
    expect(kg).toHaveLength(11);
    expect(kg[0]).toBe('112.5');
    expect(kg[1]).toBe('107.5');
    expect(kg[2]).toBe('102.5');
    expect(kg[10]).toBe('57.5');
  });

  it('rep-max table has 12 rows and 5RM equals the entered weight', () => {
    setup();
    // inverse Brzycki: 112.5 * (37 - 5) / 36 = 100 exactly.
    const kg = tableValues('rm-rep-table');
    expect(kg).toHaveLength(12);
    expect(kg[4]).toBe('100');
  });

  it('typing 80 x 8 -> 99.5', () => {
    const { weight, reps, result } = setup();
    fireEvent.change(weight, { target: { value: '80' } });
    fireEvent.change(reps, { target: { value: '8' } });
    // 80 * 36 / 29 = 99.31 -> 99.5
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

  it('more than 30 reps is rejected; 30 reps uses Brzycki (training.e1rm)', () => {
    const { reps, result } = setup();
    fireEvent.change(reps, { target: { value: '31' } });
    expect(result()).toBe('—');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at most 30 reps');
    expect(screen.queryByTestId('rm-percent-table')).not.toBeInTheDocument();
    // 100 * 36 / (37 - 30) = 514.29; /0.5 = 1028.57 -> 1029 -> 514.5
    fireEvent.change(reps, { target: { value: '30' } });
    expect(result()).toBe('514.5');
    expect(screen.getByTestId('rm-unreliable-hint')).toHaveTextContent('Estimates from more than 12 reps are unreliable');
  });

  it('unreliable hint shows only above 12 reps', () => {
    const { reps, result } = setup();
    expect(screen.queryByTestId('rm-unreliable-hint')).not.toBeInTheDocument();
    fireEvent.change(reps, { target: { value: '12' } });
    // 100 * 36 / 25 = 144
    expect(result()).toBe('144');
    expect(screen.queryByTestId('rm-unreliable-hint')).not.toBeInTheDocument();
    fireEvent.change(reps, { target: { value: '13' } });
    // 100 * 36 / 24 = 150
    expect(result()).toBe('150');
    expect(screen.getByTestId('rm-unreliable-hint')).toBeInTheDocument();
  });
});

describe('RmCalculator high-rep warning (Wave 2, G3 item 6)', () => {
  beforeEach(() => localStorage.clear());

  it('E1RM_MAX_REPS is 12 and drives the warning threshold', async () => {
    // The local E1RM_MAX_REPS copy is gone: the threshold is G1's constant itself.
    const { UNRELIABLE_ABOVE_REPS } = await import('../rm-math');
    const { E1RM_MAX_REPS } = await import('@/lib/training');
    expect(E1RM_MAX_REPS).toBe(12);
    expect(UNRELIABLE_ABOVE_REPS).toBe(E1RM_MAX_REPS);
  });

  it('warns above 12 reps and still shows the estimate', () => {
    render(
      <LocaleProvider>
        <RmCalculator />
      </LocaleProvider>,
    );
    const reps = screen.getByLabelText('Reps');
    fireEvent.change(reps, { target: { value: '12' } });
    expect(screen.queryByTestId('rm-warning')).not.toBeInTheDocument();
    // The live region is mounted (empty) before the warning appears, so it gets announced.
    const region = screen.getByTestId('rm-warning-region');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toBeEmptyDOMElement();
    fireEvent.change(reps, { target: { value: '15' } });
    // 100 * 36 / (37 - 15) = 163.64; /0.5 = 327.27 -> 327 -> 163.5
    expect(screen.getByTestId('rm-result')).toHaveTextContent('163.5');
    const warning = screen.getByTestId('rm-warning');
    expect(warning).toBeVisible();
    expect(screen.getByTestId('rm-warning-region')).toBe(region);
    expect(region).toContainElement(warning);
    expect(warning).toHaveTextContent('Estimates from more than 12 reps are unreliable');
    expect(screen.getByTestId('rm-percent-table')).toBeInTheDocument();
  });
});
