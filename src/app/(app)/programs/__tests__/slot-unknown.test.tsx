import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProgramTemplate } from '@/contracts/domain';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: vi.fn() }) }));

const { default: SessionEditorPage } = await import('../[id]/session/[sessionId]/page-client');

const REAL = 'tytax_back-upper-pulley_upper-pulley-face-pull-rope';
const slot = (exerciseId: string, exerciseName: string, sets: number) => ({ exerciseId, exerciseName, modality: 'tytax' as const, sets, reps: '8-12' });
const TEMPLATE: ProgramTemplate = {
  name: 'Ghosts',
  splitType: 'custom',
  frequency: 1,
  periodizationType: 'none',
  sessionOrder: ['Upper C'],
  sessions: [{ id: 'u', programId: '', name: 'Upper C', dayIndex: 0, exercises: [slot('ghost_one', 'Ghost Press', 4), slot(REAL, 'Face Pull', 5), slot('ghost_two', '', 2)] }],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};

let n = 0;
async function setup() {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`slot-unknown-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  const me = await repo.profiles.ensureActive('Me');
  const program = await repo.programs.create(me.id, TEMPLATE);
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <SessionEditorPage params={Promise.resolve({ id: program.id, sessionId: program.sessions[0].id })} />
      </Suspense>,
    );
  });
  const rows = async () => within(await screen.findByTestId('slot-unknown', {}, { timeout: 3000 })).getAllByRole('button');
  const save = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'prog_slot_save' }));
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith(`/programs/${program.id}`));
    return (await repo.programs.get(me.id, program.id))?.sessions[0].exercises ?? [];
  };
  return { rows, save };
}

describe('slot editor: selected ids missing from the catalog (refuter2 #4)', () => {
  it('lists them at the top as selected rows with the stored name (or a fallback)', async () => {
    const { rows } = await setup();
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r[0]).toHaveTextContent('Ghost Press');
    expect(r[1]).toHaveTextContent('prog_slot_unknown_name');
    r.forEach((b) => expect(b).toHaveAttribute('aria-pressed', 'true'));
  });

  it('removing one there drops it on save; the other slots stay intact', async () => {
    const { rows, save } = await setup();
    fireEvent.click((await rows())[0]);
    expect((await rows())[0]).toHaveAttribute('aria-pressed', 'false');
    const saved = await save();
    expect(saved.map((e) => [e.exerciseId, e.sets])).toEqual([[REAL, 5], ['ghost_two', 2]]);
  });

  it('toggling off and on again never duplicates the slot', async () => {
    const { rows, save } = await setup();
    fireEvent.click((await rows())[0]);
    fireEvent.click((await rows())[0]);
    expect((await rows())[0]).toHaveAttribute('aria-pressed', 'true');
    const saved = await save();
    expect(saved.filter((e) => e.exerciseId === 'ghost_one')).toHaveLength(1);
    expect(saved).toHaveLength(3);
    expect(saved.find((e) => e.exerciseId === 'ghost_one')).toMatchObject({ exerciseName: 'Ghost Press', sets: 4 });
  });
});
