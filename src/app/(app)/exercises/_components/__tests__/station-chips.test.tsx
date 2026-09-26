import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Exercise } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { catalog, loadCatalog } from '@/lib/catalog';
import { en } from '@/lib/i18n/en';
import { createNavStore } from './nav-mock';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, nav: undefined as unknown as ReturnType<typeof createNavStore> }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', async () => {
  const React = await import('react');
  return {
    useSearchParams: () => {
      const qs = React.useSyncExternalStore(holder.nav.subscribe, holder.nav.get, holder.nav.get);
      return React.useMemo(() => new URLSearchParams(qs), [qs]);
    },
    useRouter: () => ({
      replace: (url: string) => {
        holder.nav.set(url.split('?')[1] ?? '');
      },
      push: vi.fn(),
      back: vi.fn(),
    }),
    usePathname: () => '/exercises',
  };
});

const { ExerciseLibrary } = await import('../exercise-library');

let n = 0;
async function setup(qs = '') {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`ex-chips-${n}`) });
  holder.repo = repo;
  holder.nav = createNavStore();
  holder.nav.set(qs);
  await repo.profiles.ensureActive('Me');
  render(
    <LocaleProvider>
      <ExerciseLibrary />
    </LocaleProvider>,
  );
}

/** Same membership rule as the catalog matcher: `stationId` wins, else the display name. */
const atStation = (cat: Catalog, id: string): Exercise[] => {
  const name = cat.stations.find((s) => s.id === id)?.name.toLowerCase();
  return cat.exercises.filter((e) => (e.stationId !== undefined ? e.stationId === id : e.station?.toLowerCase() === name));
};
const chip = (id: string) => screen.getByTestId(`exercise-station-chip-${id}`);
const count = (id: string) => chip(id).querySelector('[aria-hidden="true"]')?.textContent;

afterEach(() => vi.restoreAllMocks());

describe('Station chip row', () => {
  it('has one chip per catalog station with exercises, counted from the catalog', async () => {
    const cat = await loadCatalog(['tytax']);
    const expected = cat.stations.filter((s) => atStation(cat, s.id).length > 0);
    expect(expected.length).toBeGreaterThan(1);
    await setup();
    const group = await screen.findByRole('group', { name: en.ex_filter_station });
    await waitFor(() => expect(within(group).getAllByRole('button')).toHaveLength(expected.length + 1));
    expect(chip('all')).toHaveAttribute('aria-pressed', 'true');
    for (const s of expected) expect(count(s.id)).toBe(String(atStation(cat, s.id).length));
  });

  it('writes st= to the URL, reads it back, combines with muscle group and recounts', async () => {
    const cat = await loadCatalog(['tytax']);
    const smith = cat.stations.find((s) => s.name === 'Smith Machine')!;
    const smithAll = atStation(cat, smith.id);
    const smithChest = smithAll.filter((e) => e.muscleGroup === 'CHEST').length;
    expect(smithChest).toBeGreaterThan(0);
    await setup('mg=CHEST');
    await waitFor(() => expect(count(smith.id)).toBe(String(smithChest)));
    expect(chip(smith.id)).toHaveAccessibleName(`${en.ex_station_smith}, ${smithChest} exercises`);
    fireEvent.click(chip(smith.id));
    expect(holder.nav.get()).toBe(`mg=CHEST&st=${smith.id}`);
    await waitFor(() => expect(chip(smith.id)).toHaveAttribute('aria-pressed', 'true'));
    expect(await screen.findByText(`Results: ${smithChest}`)).toBeInTheDocument();
    fireEvent.click(chip(smith.id));
    expect(holder.nav.get()).toBe('mg=CHEST');
  });

  it('an old st= link (station select era) still preselects the chip; "All" clears it', async () => {
    const cat = await loadCatalog(['tytax']);
    const st = cat.stations.find((s) => atStation(cat, s.id).length > 0)!;
    await setup(`st=${st.id}`);
    await waitFor(() => expect(chip(st.id)).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(chip('all'));
    expect(holder.nav.get()).toBe('');
  });

  it('is data-driven: a new catalog station (e.g. FRAME) gets a translated chip with no code change', async () => {
    const real = await loadCatalog(['tytax']);
    const frameEx = real.exercises.slice(0, 3);
    const withFrame: Catalog = { ...real, stations: [...real.stations, { id: 'FRAME', name: 'Frame' }] };
    const origLoad = catalog.loadCatalog;
    const origSearch = catalog.search;
    vi.spyOn(catalog, 'loadCatalog').mockImplementation(async (chunks) => (chunks?.length === 1 && chunks[0] === 'tytax' ? withFrame : origLoad(chunks)));
    vi.spyOn(catalog, 'search').mockImplementation(async (q) => (q.stationId === 'FRAME' ? frameEx : origSearch(q)));
    await setup();
    await waitFor(() => expect(chip('FRAME')).toHaveTextContent(en.ex_station_frame));
    expect(count('FRAME')).toBe('3');
  });
});
