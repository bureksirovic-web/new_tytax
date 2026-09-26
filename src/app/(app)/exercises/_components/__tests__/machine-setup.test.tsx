import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ExerciseNote, MachineSetup } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { catalog } from '@/lib/catalog';
import { en } from '@/lib/i18n/en';
import { hr } from '@/lib/i18n/hr';
import { normalizeSetup, sameSetup, setupWriter, toDraft } from '../setup-adapter';

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

let n = 0;
/**
 * Real repository on fake-indexeddb. `withWriter` adds the method requested in
 * G4-W2-20 (`notes.setSetup`), written straight to the same Dexie table so the
 * live `notes.get` query sees it, exactly as the G2 implementation would.
 */
async function setup(withWriter: boolean) {
  n += 1;
  const db = new TytaxDatabase(`ex-setup-${n}`);
  const repo = createRepository({ db });
  const calls: Array<MachineSetup | null> = [];
  if (withWriter) {
    Object.assign(repo.notes, {
      async setSetup(profileId: string, exerciseId: string, value: MachineSetup | null): Promise<ExerciseNote | undefined> {
        calls.push(value);
        const live = (await db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, exerciseId]).toArray()).find((r) => !r.deletedAt);
        const stamp = new Date().toISOString();
        const base: ExerciseNote = live ?? { id: `note-${n}-${calls.length}`, profileId, exerciseId, content: '', createdAt: stamp, updatedAt: stamp };
        const { setup: _old, ...rest } = base;
        void _old;
        const row: ExerciseNote = value ? { ...rest, setup: value, updatedAt: stamp } : { ...rest, updatedAt: stamp };
        await db.exerciseNotes.put(row);
        return row;
      },
    });
  }
  holder.repo = repo;
  const me = await repo.profiles.ensureActive('Me');
  return { repo: repo as Repository, db, profileId: me.id, calls };
}

// Derived from the catalog, not hard-coded: the first TYTAX Smith bench press.
const benchId = async () => (await catalog.search({ modality: 'tytax', text: 'smith flat bench press' }))[0].id;

function renderDetail(id: string) {
  return render(
    <LocaleProvider>
      <ExerciseDetail id={id} />
    </LocaleProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('setup-adapter (pure)', () => {
  it('normalises: trims, caps at 40, drops empties, all-empty → null', () => {
    expect(normalizeSetup({ seat: ' 4 ', pin: '', cable: 'x'.repeat(50) })).toEqual({ seat: '4', cable: 'x'.repeat(40) });
    expect(normalizeSetup({ seat: '  ', other: '' })).toBeNull();
    expect(toDraft({ benchAngle: '30°' })).toEqual({ seat: '', pin: '', backrest: '', benchAngle: '30°', cable: '', other: '' });
    expect(sameSetup({ seat: '4 ' }, toDraft({ seat: '4' }))).toBe(true);
    expect(sameSetup({ seat: '5' }, { seat: '4' })).toBe(false);
  });

  it('detects the writer only when notes.setSetup is a function', () => {
    expect(setupWriter(undefined)).toBeUndefined();
    expect(setupWriter({ get: () => undefined, set: () => undefined })).toBeUndefined();
    expect(setupWriter({ setSetup: 'nope' })).toBeUndefined();
    const notes = { seen: [] as unknown[], async setSetup(...a: unknown[]) { this.seen.push(a); return undefined; } };
    void setupWriter(notes)!.setSetup('p', 'e', { pin: '3' });
    expect(notes.seen).toEqual([['p', 'e', { pin: '3' }]]); // called with `this` = the notes repo
  });
});

describe('MachineSetupEditor on /exercises/[id]', () => {
  it('saves seat/pin/bench angle per profile, shows them again and clears them', async () => {
    const { repo, profileId, calls } = await setup(true);
    const id = await benchId();
    renderDetail(id);
    const seat = await screen.findByLabelText(en.ex_setup_seat);
    await waitFor(() => expect(seat).toBeEnabled());
    expect(screen.queryByTestId('exercise-setup-unavailable')).toBeNull();
    expect(screen.getByRole('form', { name: /Machine setup for Smith Flat Bench Press/ })).toBeInTheDocument();
    const save = screen.getByTestId('exercise-setup-save');
    expect(save).toBeDisabled();

    fireEvent.change(seat, { target: { value: ' 4 ' } });
    fireEvent.change(screen.getByLabelText(en.ex_setup_pin), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(en.ex_setup_bench_angle), { target: { value: '30°' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(calls).toEqual([{ seat: '4', pin: '7', benchAngle: '30°' }]));
    await waitFor(async () => expect((await repo.notes.get(profileId, id))?.setup).toEqual({ seat: '4', pin: '7', benchAngle: '30°' }));
    await waitFor(() => expect(save).toBeDisabled());
    expect(seat).toHaveValue('4');

    // Another profile sees nothing.
    const other = await repo.profiles.create({ name: 'Other' });
    expect(await repo.notes.get(other.id, id)).toBeUndefined();

    fireEvent.click(await screen.findByTestId('exercise-setup-clear'));
    await waitFor(() => expect(calls[1]).toBeNull());
    await waitFor(async () => expect((await repo.notes.get(profileId, id))?.setup).toBeUndefined());
    await waitFor(() => expect(screen.getByLabelText(en.ex_setup_pin)).toHaveValue(''));
    expect(screen.queryByTestId('exercise-setup-clear')).toBeNull();
  });

  it('shows a stored setup read-only with an explanation when the repo has no setSetup', async () => {
    const { db, profileId } = await setup(false);
    const id = await benchId();
    const stamp = new Date().toISOString();
    await db.exerciseNotes.put({ id: 'n1', profileId, exerciseId: id, content: 'cue', setup: { cable: 'rope' }, createdAt: stamp, updatedAt: stamp });
    renderDetail(id);
    expect(await screen.findByTestId('exercise-setup-unavailable')).toHaveTextContent(en.ex_setup_unavailable);
    await waitFor(() => expect(screen.getByTestId('exercise-setup-cable')).toHaveValue('rope'));
    for (const f of ['seat', 'pin', 'backrest', 'benchAngle', 'cable', 'other']) expect(screen.getByTestId(`exercise-setup-${f}`)).toBeDisabled();
    expect(screen.getByTestId('exercise-setup-save')).toBeDisabled();
    expect(screen.getByTestId('exercise-setup-clear')).toBeDisabled();
  });

  it('is not offered for kettlebell exercises', async () => {
    await setup(true);
    const kb = (await catalog.search({ modality: 'kettlebell' }))[0];
    renderDetail(kb.id);
    expect(await screen.findByTestId('page-heading-exercise-detail')).toHaveTextContent(kb.name);
    expect(screen.queryByTestId('exercise-setup')).toBeNull();
  });

  it('has hr translations for every setup string', () => {
    for (const k of ['ex_setup', 'ex_setup_seat', 'ex_setup_pin', 'ex_setup_unavailable'] as const) {
      expect(hr[k]).toBeTruthy();
      expect(hr[k]).not.toBe(en[k]);
    }
  });
});
