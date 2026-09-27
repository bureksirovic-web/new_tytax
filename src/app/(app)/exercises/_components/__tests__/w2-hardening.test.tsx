/**
 * Wave 2 hardening (refuter2 findings 6 and 8):
 * - the e1RM on /exercises must be the same figure /analytics shows (no 0.1 kg pre-rounding);
 * - clearing the note text must not silently drop the machine setup on the same row.
 *   Pre-G2 repo (v2-g4 alone): `notes.set(p, e, '')` deletes the row, so the UI asks
 *   first. G2 repo (merged tree): the row and its setup are kept (G4-W2-55), so the
 *   UI clears the text straight away. The confirm test takes the branch its tree's real repo has;
 *   the cancel path is forced onto the pre-G2 shape so it runs in both.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import type { WorkoutDraft } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { exerciseSeries } from '@/components/analytics/exercise-series';
import { formatWeight } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { hr } from '@/lib/i18n/hr';
import { rankableE1rm } from '@/lib/training';
import { bestE1rm, e1rmSeries } from '../history-stats';
import { clearKeepsSetup } from '../setup-adapter';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { ExerciseDetail } = await import('../exercise-detail');

const BENCH = 'tytax_smith-machine_smith-flat-bench-press';
let n = 0;
/** Whether this tree's real repository keeps the setup when the note is cleared (G2, G4-W2-55). */
const KEEPS = clearKeepsSetup(createRepository({ db: new TytaxDatabase('ex-w2h-probe') }).notes);

async function setup(units: 'kg' | 'lb' = 'kg', preG2 = false) {
  n += 1;
  const db = new TytaxDatabase(`ex-w2h-${n}`);
  const repo = createRepository({ db });
  // Hide G2's setup API so the UI takes the pre-G2 (row-deleting) branch.
  if (preG2) Object.assign(repo.notes, { setSetup: undefined, getSetup: undefined });
  holder.repo = repo;
  const me = await repo.profiles.ensureActive('Me');
  await repo.profiles.updateSettings(me.id, { units });
  return { repo: repo as Repository, db, profileId: me.id };
}

const renderDetail = (id: string) =>
  render(
    <LocaleProvider>
      <ExerciseDetail id={id} />
    </LocaleProvider>,
  );

beforeEach(() => localStorage.clear());

describe('e1RM parity with /analytics (refuter2 #6)', () => {
  it('uses the rankableE1rm value unrounded, so lb matches analytics', async () => {
    const set = { id: 'a', type: 'working' as const, kg: 20, reps: 6, done: true };
    const rank = rankableE1rm(set)!; // 23.23 kg
    expect(bestE1rm([set])).toBe(rank);

    const { repo, profileId } = await setup('lb');
    const log = buildWorkoutLog(profileId, { daysAgo: 1, sessionName: 'Push', exercises: [{ exerciseId: BENCH, exerciseName: 'Bench', sets: [{ kg: 20, reps: 6 }] }] }, new Date(), sequentialIds(`w2h-${n}`));
    const draft: WorkoutDraft = { id: log.id, profileId, sessionName: log.sessionName, startedAt: log.startedAt, exercises: log.exercises };
    await repo.finishWorkout(draft, { finishedAt: log.finishedAt });
    const logs = await repo.logs.list(profileId);
    const analytics = exerciseSeries(logs, BENCH)[0].e1rm;
    expect(e1rmSeries(logs, BENCH)[0].e1rm).toBe(analytics);
    const shown = formatWeight(analytics, 'lb', 'en'); // "51.2 lb" (the pre-rounded 23.2 kg gave "51.1 lb")
    expect(shown).toBe('51.2 lb');

    renderDetail(BENCH);
    await waitFor(() => expect(screen.getByTestId('exercise-best-e1rm')).toHaveTextContent(shown));
  });
});

describe('clearing a note that shares its row with a machine setup (refuter2 #8)', () => {
  async function seedNote(setupValue?: { seat: string }, preG2 = false) {
    const ctx = await setup('kg', preG2);
    const stamp = new Date().toISOString();
    await ctx.db.exerciseNotes.put({ id: `n-${n}`, profileId: ctx.profileId, exerciseId: BENCH, content: 'elbows in', ...(setupValue ? { setup: setupValue } : {}), createdAt: stamp, updatedAt: stamp });
    renderDetail(BENCH);
    const box = await screen.findByLabelText(/Notes for Smith Flat Bench Press/);
    await waitFor(() => expect(box).toHaveValue('elbows in'));
    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: en.ex_notes_save }));
    return { ...ctx, box };
  }

  it('pre-G2 repo: asks first; cancel keeps note and setup untouched', async () => {
    const { repo, profileId, box } = await seedNote({ seat: '4' }, true);
    const dialog = await screen.findByRole('dialog', { name: en.ex_notes_clear_title });
    expect(dialog).toHaveTextContent(en.ex_notes_clear_setup_msg);
    fireEvent.click(within(dialog).getByRole('button', { name: en.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = await repo.notes.get(profileId, BENCH);
    expect(row).toMatchObject({ content: 'elbows in', setup: { seat: '4' } });
    expect(box).toHaveValue('   '); // the edit is kept, not thrown away
  });

  // One test, the branch this tree's real repo has (KEEPS); the other branch is covered by the other tree.
  it(`${KEEPS ? 'G2 repo: clears the text without asking and keeps the setup (G4-W2-55)' : 'pre-G2 repo: clears (row and setup) only after the user confirms'}`, async () => {
    const { repo, profileId, box } = await seedNote({ seat: '4' });
    if (!KEEPS) {
      const dialog = await screen.findByRole('dialog', { name: en.ex_notes_clear_title });
      fireEvent.click(within(dialog).getByRole('button', { name: en.ex_notes_clear_confirm }));
      await waitFor(async () => expect(await repo.notes.get(profileId, BENCH)).toBeUndefined());
      return;
    }
    await waitFor(async () => expect(await repo.notes.get(profileId, BENCH)).toMatchObject({ content: '', setup: { seat: '4' } }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(box).toHaveValue(''));
    expect(screen.getByTestId('exercise-setup-seat')).toHaveValue('4');
  });

  it('clears straight away when there is no setup on the row', async () => {
    const { repo, profileId } = await seedNote();
    await waitFor(async () => expect(await repo.notes.get(profileId, BENCH)).toBeUndefined());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has hr translations for the confirmation', () => {
    for (const k of ['ex_notes_clear_title', 'ex_notes_clear_setup_msg', 'ex_notes_clear_confirm'] as const) {
      expect(hr[k]).toBeTruthy();
      expect(hr[k]).not.toBe(en[k]);
    }
  });
});
