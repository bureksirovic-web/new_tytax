import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { en } from '@/lib/i18n/en';
import { loadCatalog } from '@/lib/catalog';
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
        holder.nav.replaced.push(url);
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
async function setup(qs = ''): Promise<{ repo: Repository; profileId: string }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`ex-lib-${n}`) });
  holder.repo = repo;
  holder.nav = createNavStore();
  holder.nav.set(qs);
  const me = await repo.profiles.ensureActive('Me');
  return { repo, profileId: me.id };
}

function renderLib() {
  return render(
    <LocaleProvider>
      <ExerciseLibrary />
    </LocaleProvider>,
  );
}

const rows = () => within(screen.getByTestId('exercise-list')).getAllByRole('listitem');
const results = (k: number) => en.ex_results.replace('{n}', String(k));

beforeEach(() => {
  localStorage.clear();
});

describe('ExerciseLibrary', () => {
  it('pages the whole catalog 30 at a time', async () => {
    await setup();
    renderLib();
    expect(await screen.findByTestId('page-heading-exercises')).toHaveTextContent(en.ex_title);
    await waitFor(() => expect(rows()).toHaveLength(30));
    fireEvent.click(screen.getByRole('button', { name: /Load more/ }));
    expect(rows()).toHaveLength(60);
  });

  it('search is debounced, diacritic-insensitive and written to the URL', async () => {
    await setup();
    renderLib();
    const box = await screen.findByRole('searchbox');
    fireEvent.change(box, { target: { value: 'smith bench' } });
    await waitFor(() => expect(holder.nav.get()).toBe('q=smith+bench'), { timeout: 2000 });
    const plain = await screen.findByText(/^Results: \d+$/);
    const plainCount = Number(plain.textContent?.replace(/\D/g, ''));
    expect(plainCount).toBeGreaterThan(0);
    expect(plainCount).toBeLessThan(200);
    fireEvent.change(box, { target: { value: 'smîth béñch' } });
    await waitFor(() => expect(holder.nav.get()).toContain('q=sm'), { timeout: 2000 });
    expect(await screen.findByText(results(plainCount))).toBeInTheDocument();
  });

  it('station filter from the URL narrows to that station; filters combine and clear', async () => {
    // The station id comes from the loaded catalog (ids differ between catalog builds); an entry belongs to
    // the station by its `stationId`, or, without one, by its display `station` equal to the station name.
    const cat = await loadCatalog(['tytax']);
    const smith = cat.stations.find((s) => s.name === 'Smith Machine');
    expect(smith).toBeDefined();
    const atSmith = cat.exercises.filter((e) => (e.stationId !== undefined ? e.stationId === smith!.id : e.station === smith!.name));
    expect(atSmith.length).toBeGreaterThan(30); // more than one page, fewer than the whole catalog
    expect(atSmith.length).toBeLessThan(cat.exercises.length);
    await setup(`st=${smith!.id}`);
    renderLib();
    expect(await screen.findByText(results(atSmith.length))).toBeInTheDocument();
    const muscle = screen.getByLabelText(en.ex_filter_muscle);
    fireEvent.change(muscle, { target: { value: 'CHEST' } });
    expect(holder.nav.get()).toBe(`mg=CHEST&st=${smith!.id}`);
    const chestSmith = atSmith.filter((e) => e.muscleGroup === 'CHEST').length;
    expect(chestSmith).toBeGreaterThan(0);
    expect(await screen.findByText(results(chestSmith))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.ex_clear_filters }));
    expect(holder.nav.get()).toBe('');
  });

  it('modality chip keeps only that modality and hides TYTAX-only filters', async () => {
    await setup();
    renderLib();
    await waitFor(() => expect(rows()).toHaveLength(30));
    fireEvent.click(screen.getByRole('button', { name: en.ex_modality_kettlebell }));
    expect(holder.nav.get()).toBe('m=kettlebell');
    await waitFor(() => expect(rows()[0]).toHaveTextContent(en.ex_modality_kettlebell));
    for (const r of rows()) expect(r).toHaveTextContent(en.ex_modality_kettlebell);
    expect(screen.queryByLabelText(en.ex_filter_station)).toBeNull();
  });

  it('star adds to the Arsenal of the active profile only; favorites=1 lists only favourites', async () => {
    const { repo, profileId } = await setup();
    const other = await repo.profiles.create({ name: 'Other' });
    await repo.arsenal.add(other.id, 'tytax_smith-machine_smith-flat-bench-press');
    renderLib();
    await waitFor(() => expect(rows()).toHaveLength(30));
    const first = rows()[0];
    const firstName = within(first).getByRole('link').querySelector('span')?.textContent ?? '';
    const star = within(first).getByRole('button', { name: `Add ${firstName} to Arsenal` });
    await waitFor(() => expect(star).toBeEnabled());
    fireEvent.click(star);
    await waitFor(() => expect(within(rows()[0]).getByTestId('exercise-favourite')).toHaveAttribute('aria-pressed', 'true'));
    const mine = await repo.arsenal.list(profileId);
    expect(mine).toHaveLength(1);

    act(() => holder.nav.set('favorites=1'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent(firstName);
    expect(screen.getByTestId('exercise-tab-arsenal')).toHaveAttribute('aria-pressed', 'true');

    // Un-star → Arsenal empty state.
    fireEvent.click(within(rows()[0]).getByTestId('exercise-favourite'));
    expect(await screen.findByText(en.ex_arsenal_empty_title)).toBeInTheDocument();
    expect(await repo.arsenal.list(profileId)).toHaveLength(0);
  });

  it('a pending debounced search keeps a filter changed meanwhile', async () => {
    await setup();
    renderLib();
    await waitFor(() => expect(rows()).toHaveLength(30));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'swing' } });
    // Before the 300 ms debounce fires, pick a modality. The old closure would commit q with m dropped.
    fireEvent.click(screen.getByRole('button', { name: en.ex_modality_kettlebell }));
    expect(holder.nav.get()).toBe('m=kettlebell');
    await waitFor(() => expect(holder.nav.get()).toBe('q=swing&m=kettlebell'), { timeout: 2000 });
  });

  it('clear filters cancels a pending keystroke and empties the box', async () => {
    await setup('mg=CHEST');
    renderLib();
    const box = await screen.findByRole('searchbox');
    fireEvent.change(box, { target: { value: 'press' } });
    fireEvent.click(screen.getByRole('button', { name: en.ex_clear_filters }));
    expect(holder.nav.get()).toBe('');
    await new Promise((r) => setTimeout(r, 450));
    expect(holder.nav.get()).toBe('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('search box follows back-navigation to an earlier query', async () => {
    await setup();
    renderLib();
    const box = await screen.findByRole('searchbox');
    fireEvent.change(box, { target: { value: 'row' } });
    await waitFor(() => expect(holder.nav.get()).toBe('q=row'), { timeout: 2000 });
    act(() => holder.nav.set(''));
    await waitFor(() => expect(box).toHaveValue(''));
    act(() => holder.nav.set('q=row'));
    await waitFor(() => expect(box).toHaveValue('row'));
  });

  it('Arsenal tab without any profile shows the empty state, not an endless skeleton', async () => {
    n += 1;
    holder.repo = createRepository({ db: new TytaxDatabase(`ex-lib-noprofile-${n}`) });
    holder.nav = createNavStore();
    holder.nav.set('favorites=1');
    renderLib();
    expect(await screen.findByText(en.ex_arsenal_empty_title)).toBeInTheDocument();
  });
});
