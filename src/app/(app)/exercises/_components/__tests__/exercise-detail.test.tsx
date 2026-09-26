import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import type { WorkoutDraft } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { en } from '@/lib/i18n/en';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { ExerciseDetail, backHref } = await import('../exercise-detail');
const { safeDecodeId } = await import('../library-params');

const BENCH = 'tytax_smith-machine_smith-flat-bench-press';
let n = 0;

async function setup(units: 'kg' | 'lb' = 'kg'): Promise<{ repo: Repository; profileId: string }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`ex-detail-${n}`) });
  holder.repo = repo;
  const me = await repo.profiles.ensureActive('Me');
  await repo.profiles.updateSettings(me.id, { units });
  return { repo, profileId: me.id };
}

/** Finish a synthetic workout through the repository (the real write path). */
async function seedLog(repo: Repository, profileId: string, daysAgo: number, sets: Array<{ kg: number; reps: number; rir?: number; type?: 'warmup' | 'working'; done?: boolean }>, name = 'Push') {
  const log = buildWorkoutLog(profileId, { daysAgo, sessionName: name, exercises: [{ exerciseId: BENCH, exerciseName: 'Bench', sets }] }, new Date(), sequentialIds(`s${n}-${daysAgo}`));
  const draft: WorkoutDraft = { id: log.id, profileId, sessionName: log.sessionName, startedAt: log.startedAt, exercises: log.exercises };
  await repo.finishWorkout(draft, { finishedAt: log.finishedAt });
  return log.id;
}

function renderDetail(id: string) {
  return render(
    <LocaleProvider>
      <ExerciseDetail id={id} />
    </LocaleProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('ExerciseDetail', () => {
  it('shows a not-found state (not a spinner) for an unknown id', async () => {
    await setup();
    renderDetail('tytax_does-not-exist');
    expect(await screen.findByTestId('page-heading-exercise-detail')).toHaveTextContent(en.ex_detail_not_found);
    expect(screen.getByRole('link', { name: new RegExp(en.ex_detail_back) })).toHaveAttribute('href', '/exercises');
  });

  it('renders header, labelled external videos and the impact list', async () => {
    await setup();
    renderDetail(BENCH);
    expect(await screen.findByTestId('page-heading-exercise-detail')).toHaveTextContent('Smith Flat Bench Press');
    const videos = within(screen.getByTestId('exercise-videos')).getAllByRole('link');
    // Catalog: app.tytax + 2 YouTube, plus the search link.
    expect(videos.map((a) => a.textContent)).toEqual(['▶TYTAX app', '▶YouTube 1', '▶YouTube 2', '⌕Search YouTube']);
    for (const a of videos) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a.getAttribute('aria-label')).toMatch(/opens in a new tab/);
    }
    expect(videos[0]).toHaveAttribute('href', expect.stringContaining('app.tytax.com'));
    const impact = within(screen.getByTestId('exercise-impact')).getAllByRole('listitem');
    // Chest 95 → Primary, Triceps 65 → Secondary, Front delts 35 → Tertiary (sorted desc).
    expect(impact.map((li) => li.querySelector('.sr-only')?.textContent)).toEqual([
      'Chest: 95 of 100, Primary',
      'Triceps: 65 of 100, Secondary',
      'Front delts: 35 of 100, Tertiary',
    ]);
  });

  it('lists this profile’s history in lb, excludes warm-ups, other profiles and deleted logs', async () => {
    const { repo, profileId } = await setup('lb');
    const older = await seedLog(repo, profileId, 6, [{ kg: 100, reps: 5, rir: 2 }, { kg: 50, reps: 10, type: 'warmup' }], 'Older');
    const newer = await seedLog(repo, profileId, 2, [{ kg: 105, reps: 3 }], 'Newer');
    const gone = await seedLog(repo, profileId, 1, [{ kg: 300, reps: 3 }], 'Deleted');
    await repo.logs.softDelete(profileId, gone);
    const other = await repo.profiles.create({ name: 'Other' });
    await seedLog(repo, other.id, 3, [{ kg: 400, reps: 3 }], 'Foreign');

    renderDetail(BENCH);
    const list = await screen.findByTestId('exercise-history');
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(2));
    const links = within(list).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/history/${newer}`);
    expect(links[1]).toHaveAttribute('href', `/history/${older}`);
    // 100 kg = 220.462 → "220.5 lb"; 100×5 e1RM 112.5 kg × 2.20462 = 248.02 → "248 lb".
    expect(links[1]).toHaveTextContent('220.5 lb×5 @2');
    // The link's accessible name carries the sets (no aria-label hiding them from screen readers).
    expect(links[1]).toHaveAccessibleName(/Older.*220\.5 lb×5/);
    expect(links[1]).not.toHaveTextContent('110.2 lb'); // 50 kg warm-up not listed
    expect(screen.getByTestId('exercise-best-e1rm')).toHaveTextContent('248 lb');
    expect(screen.queryByText(/Deleted|Foreign/)).toBeNull();
    // Two sessions → chart rendered with a text summary; 105×3 → 105·36/34 = 111.18 → 111.2 kg; 111.2 × 2.20462 = 245.15 → 245.2 lb.
    const chart = screen.getByTestId('exercise-e1rm-chart');
    expect(within(chart).getByRole('img').getAttribute('aria-label')).toMatch(/2 sessions: from 248 lb .* to 245\.2 lb .* best 248 lb/);
  });

  it('keeps notes per exercise: saved on one, empty on another', async () => {
    const { repo, profileId } = await setup();
    const view = renderDetail(BENCH);
    const box = await screen.findByLabelText(/Notes for Smith Flat Bench Press/);
    await waitFor(() => expect(box).toBeEnabled());
    fireEvent.change(box, { target: { value: 'Seat 4' } });
    fireEvent.click(screen.getByRole('button', { name: en.ex_notes_save }));
    await waitFor(async () => expect((await repo.notes.get(profileId, BENCH))?.content).toBe('Seat 4'));
    await waitFor(() => expect(screen.getByRole('button', { name: en.ex_notes_save })).toBeDisabled());
    expect(box).toHaveValue('Seat 4');

    const catalogMod = await import('@/lib/catalog');
    const otherId = (await catalogMod.catalog.search({ modality: 'tytax', text: 'leg curl' }))[0].id;
    view.rerender(
      <LocaleProvider>
        <ExerciseDetail id={otherId} />
      </LocaleProvider>,
    );
    const other = await screen.findByLabelText(/Notes for/);
    await waitFor(() => expect(other).toBeEnabled());
    expect(other).toHaveValue('');
    expect(await repo.notes.get(profileId, otherId)).toBeUndefined();
  });

  it('back link restores a validated library query', () => {
    expect(backHref('q=bench&m=tytax&st=smith')).toBe('/exercises?q=bench&m=tytax&st=smith');
    expect(backHref('st=%3Cx%3E&evil=1')).toBe('/exercises');
    expect(backHref(null)).toBe('/exercises');
  });

  it('decodes route ids once and never throws on a malformed escape', async () => {
    expect(safeDecodeId('a%20b')).toBe('a b');
    expect(safeDecodeId('%')).toBe('%');
    await setup();
    renderDetail(safeDecodeId('%E0%A4%A'));
    expect(await screen.findByTestId('page-heading-exercise-detail')).toHaveTextContent(en.ex_detail_not_found);
  });
});
