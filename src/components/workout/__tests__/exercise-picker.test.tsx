import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Catalog } from '@/contracts/exercise-catalog';

const catalogState = vi.fn<() => { catalog: Catalog | undefined; loading: boolean; error: unknown }>();
vi.mock('@/hooks/use-exercises', () => ({ useCatalog: () => catalogState() }));

import { LocaleProvider } from '@/components/providers/locale-provider';
import { ExercisePicker } from '../exercise-picker';
import { ex, fakeCatalog } from './picker-helpers';

const BASE = [
  ex('bench', 'Bench Press'),
  ex('squat', 'Čučanj', { muscleGroup: 'QUADS', pattern: 'squat' }),
  ex('pushup', 'Push-up', { modality: 'bodyweight' }),
  ex('swing', 'Swing', { modality: 'kettlebell', muscleGroup: 'GLUTES', pattern: 'hinge' }),
];

function setup(exercises = BASE) {
  catalogState.mockReturnValue({ catalog: fakeCatalog(exercises), loading: false, error: undefined });
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <LocaleProvider>
      <ExercisePicker onPick={onPick} onClose={onClose} />
    </LocaleProvider>,
  );
  const optionIds = () => screen.queryAllByTestId('exercise-option').map((b) => b.getAttribute('data-exercise-id'));
  return { onPick, onClose, optionIds };
}

describe('ExercisePicker', () => {
  beforeEach(() => {
    localStorage.clear();
    catalogState.mockReset();
  });

  it('shows loading while the lazy catalog loads', () => {
    catalogState.mockReturnValue({ catalog: undefined, loading: true, error: undefined });
    render(
      <LocaleProvider>
        <ExercisePicker onPick={vi.fn()} onClose={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('exercise-picker')).toHaveAttribute('role', 'dialog');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryAllByTestId('exercise-option')).toHaveLength(0);
  });

  it('shows an error when the catalog fails', () => {
    catalogState.mockReturnValue({ catalog: undefined, loading: false, error: new Error('x') });
    render(
      <LocaleProvider>
        <ExercisePicker onPick={vi.fn()} onClose={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('focuses search on open, lists all, searches diacritic-insensitively and picks by click', () => {
    const { onPick, optionIds } = setup();
    const search = screen.getByTestId('exercise-search');
    expect(search).toHaveFocus();
    expect(optionIds()).toEqual(['bench', 'squat', 'pushup', 'swing']);
    fireEvent.change(search, { target: { value: 'CUCANJ' } });
    expect(optionIds()).toEqual(['squat']);
    fireEvent.click(screen.getByTestId('exercise-option'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'squat' }));
  });

  it('Enter picks the first match; Escape and the close button close', () => {
    const { onPick, onClose } = setup();
    const search = screen.getByTestId('exercise-search');
    fireEvent.change(search, { target: { value: 'sw' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'swing' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('exercise-picker-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Enter with no match picks nothing and the empty state shows', () => {
    const { onPick } = setup();
    const search = screen.getByTestId('exercise-search');
    fireEvent.change(search, { target: { value: 'zzzz' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText('No exercises found')).toBeInTheDocument();
  });

  it('modality and muscle selects filter, with localized labels', () => {
    const { optionIds } = setup();
    const modality = screen.getByTestId('exercise-filter-modality');
    const muscle = screen.getByTestId('exercise-filter-muscle');
    expect(screen.getByLabelText('Equipment')).toBe(modality);
    expect(screen.getByLabelText('Muscle group')).toBe(muscle);
    expect(within(modality).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual([
      'all',
      'tytax',
      'bodyweight',
      'kettlebell',
    ]);
    // "All muscles" + 12 groups
    expect(within(muscle).getAllByRole('option')).toHaveLength(13);
    expect(within(muscle).getByRole('option', { name: 'Quads' })).toHaveValue('QUADS');

    fireEvent.change(modality, { target: { value: 'bodyweight' } });
    expect(optionIds()).toEqual(['pushup']);
    fireEvent.change(modality, { target: { value: 'all' } });
    fireEvent.change(muscle, { target: { value: 'CHEST' } });
    expect(optionIds()).toEqual(['bench', 'pushup']);
  });

  it('caps at 60 rows with "show more" adding the next 60', () => {
    const many = Array.from({ length: 130 }, (_, i) => ex(`e${i}`, `Exercise ${i}`));
    const { optionIds } = setup(many);
    expect(optionIds()).toHaveLength(60);
    expect(screen.getByText('Showing 60 of 130')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('exercise-show-more'));
    expect(optionIds()).toHaveLength(120);
    fireEvent.click(screen.getByTestId('exercise-show-more'));
    expect(optionIds()).toHaveLength(130);
    expect(screen.queryByTestId('exercise-show-more')).not.toBeInTheDocument();
    // a filter change resets the page
    fireEvent.change(screen.getByTestId('exercise-search'), { target: { value: 'exercise' } });
    expect(optionIds()).toHaveLength(60);
  });

  it('renders Croatian labels', () => {
    localStorage.setItem('locale', 'hr');
    setup();
    expect(screen.getByLabelText('Mišićna skupina')).toBeInTheDocument();
    expect(screen.getByLabelText('Pretraži vježbe...')).toBeInTheDocument();
    expect(within(screen.getByTestId('exercise-filter-muscle')).getByRole('option', { name: 'Prsa' })).toHaveValue('CHEST');
  });

  it('option buttons meet the 44px target', () => {
    setup();
    for (const b of screen.getAllByTestId('exercise-option')) expect(b).toHaveClass('min-h-11');
    expect(screen.getByTestId('exercise-picker-close')).toHaveClass('min-h-11', 'min-w-11');
  });
});
