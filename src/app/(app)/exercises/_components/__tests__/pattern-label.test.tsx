import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Exercise } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { SlotResults } from '@/components/programs/slot-editor/slot-results';
import type { SlotEditorState } from '@/components/programs/slot-editor/use-slot-editor';
import { patternKey, patternLabel } from '@/lib/i18n/pattern';
import { en } from '@/lib/i18n/en';
import { hr } from '@/lib/i18n/hr';
import { ExerciseHeader } from '../exercise-header';

const BENCH = 'tytax_smith-machine_smith-flat-bench-press';
const noop = async () => true;
// Loaded through the lazy catalog (never '@/data/**' directly), so the test follows G1's data.
let ALL_EXERCISES: readonly Exercise[] = [];
beforeAll(async () => {
  ALL_EXERCISES = (await catalog.loadCatalog()).exercises;
});

function header(ex: Exercise) {
  return render(
    <LocaleProvider>
      <ExerciseHeader exercise={ex} favourite={false} favouriteDisabled onToggleFavourite={noop} />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('locale', 'hr');
});

describe('movement pattern label (hr)', () => {
  it('every catalog pattern has an en + hr label', () => {
    const missing = [...new Set(ALL_EXERCISES.map((e) => e.pattern).filter(Boolean))].filter((p) => !patternKey(p));
    expect(missing).toEqual([]);
  });

  it('normalises case and separators to one key', () => {
    expect(patternKey('Horizontal Push')).toBe(patternKey('horizontal-push'));
    expect(patternLabel('hinge-pull-overhead', 'en')).toBe(en.pat_hinge_pull_overhead);
    expect(patternLabel('Some Custom Pattern', 'hr')).toBe('Some Custom Pattern');
  });

  it('exercise header shows the Croatian pattern, not the raw catalog string', () => {
    const bench = ALL_EXERCISES.find((e) => e.id === BENCH)!;
    const key = patternKey(bench.pattern)!;
    expect(key).toBeTruthy();
    header(bench);
    const text = screen.getByText(/Obrazac pokreta/).textContent ?? '';
    expect(text).toContain(hr[key]);
    expect(text).not.toContain(bench.pattern);
  });

  it('kettlebell hyphenated pattern is localised in the header', () => {
    const kb = ALL_EXERCISES.find((e) => e.pattern === 'hinge-pull-overhead')!;
    header(kb);
    const text = screen.getByText(/Obrazac pokreta/).textContent ?? '';
    expect(text).toContain(hr.pat_hinge_pull_overhead);
    expect(text).not.toContain('hinge-pull-overhead');
  });

  it('slot editor result rows show the Croatian pattern', () => {
    const ex = ALL_EXERCISES.find((e) => e.pattern === 'Vertical Pull')!;
    const ed = { catalog: { stations: [] }, results: [ex], visible: 20, selected: [], toggle: () => {}, filter: { muscle: 'ALL' }, setFilter: () => {}, clearFilters: () => {}, showMore: () => {} } as unknown as SlotEditorState;
    render(
      <LocaleProvider>
        <SlotResults ed={ed} />
      </LocaleProvider>,
    );
    const row = screen.getByTestId('slot-results');
    expect(row.textContent).toContain(hr.pat_vertical_pull);
    expect(row.textContent).not.toContain('Vertical Pull');
  });
});
