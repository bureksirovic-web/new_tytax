import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EquipmentInventory, SessionExercise } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';

const catalogState = vi.fn<() => { catalog: Catalog | undefined; loading: boolean; error: unknown }>();
const profileState = vi.fn<() => { profileId: string | undefined; loading: boolean }>();
const inventoryState = vi.fn<() => { data: EquipmentInventory | null | undefined; loading: boolean; error: unknown }>();
vi.mock('@/hooks/use-exercises', () => ({ useCatalog: () => catalogState() }));
vi.mock('@/hooks/use-repo', () => ({
  useActiveProfile: () => ({ ...profileState(), profile: undefined }),
  useRepoQuery: () => inventoryState(),
}));

import { LocaleProvider } from '@/components/providers/locale-provider';
import { SwapSheet } from '../swap-sheet';
import { ex, fakeCatalog } from './picker-helpers';

const CATALOG = [
  ex('bench', 'Bench Press', { stationId: 'st1' }),
  ex('incline', 'Incline Press', { stationId: 'st1' }),
  ex('fly', 'Cable Fly', { pattern: 'fly', stationId: 'st2' }),
  ex('dip', 'Dip', { modality: 'bodyweight' }),
  ex('squat', 'Squat', { muscleGroup: 'QUADS', pattern: 'squat', stationId: 'st1' }),
];
const SE: SessionExercise = { uid: 'u1', exerciseId: 'bench', exerciseName: 'Bench Press', modality: 'tytax', sets: [] };

function inventory(stationIds: string[]): EquipmentInventory {
  const at = '2026-09-26T00:00:00.000Z';
  return { id: 'p1', profileId: 'p1', stationIds, attachmentIds: [], kettlebellsKg: [], bodyweightGear: [], createdAt: at, updatedAt: at };
}

function setup(exercise: SessionExercise = SE) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    <LocaleProvider>
      <SwapSheet exercise={exercise} onPick={onPick} onClose={onClose} />
    </LocaleProvider>,
  );
  const optionIds = () => screen.queryAllByTestId('swap-option').map((b) => b.getAttribute('data-exercise-id'));
  return { onPick, onClose, optionIds };
}

describe('SwapSheet', () => {
  beforeEach(() => {
    localStorage.clear();
    catalogState.mockReturnValue({ catalog: fakeCatalog(CATALOG), loading: false, error: undefined });
    profileState.mockReturnValue({ profileId: 'p1', loading: false });
    inventoryState.mockReturnValue({ data: inventory([]), loading: false, error: undefined });
  });

  it('lists similar exercises (muscle+pattern first), excluding the target', () => {
    const { optionIds } = setup();
    expect(screen.getByTestId('swap-sheet')).toHaveAttribute('role', 'dialog');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Swap Bench Press');
    // both: Dip, Incline Press | muscle only: Cable Fly | Squat unrelated
    expect(optionIds()).toEqual(['dip', 'incline', 'fly']);
    expect(screen.getByTestId('swap-search')).toHaveFocus();
  });

  it('filters tytax exercises by the owned stations', () => {
    inventoryState.mockReturnValue({ data: inventory(['st1']), loading: false, error: undefined });
    const { optionIds } = setup();
    // Cable Fly needs st2 (not owned); Dip is bodyweight -> always available
    expect(optionIds()).toEqual(['dip', 'incline']);
  });

  it('more than 2 typed chars switch to name search', () => {
    const { optionIds } = setup();
    const search = screen.getByTestId('swap-search');
    fireEvent.change(search, { target: { value: 'sq' } });
    expect(optionIds()).toEqual(['dip', 'incline', 'fly']);
    fireEvent.change(search, { target: { value: 'squ' } });
    expect(optionIds()).toEqual(['squat']);
    expect(screen.getByText('Name matches')).toBeInTheDocument();
  });

  it('click and Enter pick; Escape closes', () => {
    const { onPick, onClose } = setup();
    fireEvent.click(screen.getAllByTestId('swap-option')[1]);
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'incline' }));
    fireEvent.keyDown(screen.getByTestId('swap-search'), { key: 'Enter' });
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'dip' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('waits for catalog, profile and inventory before listing', () => {
    inventoryState.mockReturnValue({ data: undefined, loading: true, error: undefined });
    const { optionIds } = setup();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(optionIds()).toEqual([]);
  });

  it('custom exercise (not in the catalog) asks for a name search', () => {
    const { optionIds } = setup({ ...SE, exerciseId: 'custom-1', exerciseName: 'My Press' });
    expect(optionIds()).toEqual([]);
    expect(screen.getByText('Type 3 or more letters to search by name')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('swap-search'), { target: { value: 'press' } });
    expect(optionIds()).toEqual(['bench', 'incline']);
  });

  it('shows the empty state when nothing is available', () => {
    catalogState.mockReturnValue({ catalog: fakeCatalog([CATALOG[0], CATALOG[4]]), loading: false, error: undefined });
    const { optionIds } = setup();
    expect(optionIds()).toEqual([]);
    expect(screen.getByText('No available alternatives')).toBeInTheDocument();
  });
});
