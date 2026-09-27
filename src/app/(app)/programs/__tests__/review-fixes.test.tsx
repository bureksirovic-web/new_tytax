import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProgramTemplate } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }));

const { default: ProgramDetailPage } = await import('../[id]/page-client');
const { default: SessionEditorPage } = await import('../[id]/session/[sessionId]/page-client');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`program-review-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  return repo;
}

const slot = (exerciseId: string) => ({ exerciseId, exerciseName: exerciseId.toUpperCase(), modality: 'tytax' as const, sets: 3, reps: '8-12' });

const TEMPLATE: ProgramTemplate = {
  name: 'Split',
  splitType: 'upper_lower',
  frequency: 2,
  periodizationType: 'none',
  sessionOrder: ['Upper A', 'Lower A'],
  sessions: [
    { id: 't1', programId: '', name: 'Upper A', dayIndex: 0, exercises: [slot('bench'), slot('row')] },
    { id: 't2', programId: '', name: 'Lower A', dayIndex: 1, exercises: [] },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};

async function renderPage(node: React.ReactNode) {
  await act(async () => {
    render(<Suspense fallback={null}>{node}</Suspense>);
  });
}

describe('programs review fixes', () => {
  it('an open inline editor keeps its unsaved values when its row is moved', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderPage(<ProgramDetailPage params={Promise.resolve({ id: program.id })} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'prog_edit_named' }))[1]); // ROW
    fireEvent.click(within(screen.getByRole('group', { name: 'prog_sets' })).getAllByRole('button')[1]); // 3 → 4
    fireEvent.click(screen.getAllByRole('button', { name: 'prog_move_up_named' })[1]);
    await waitFor(async () =>
      expect((await repo.programs.get(me.id, program.id))?.sessions[0].exercises.map((e) => e.exerciseId)).toEqual(['row', 'bench']),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'prog_done' }));
    await waitFor(async () => expect((await repo.programs.get(me.id, program.id))?.sessions[0].exercises[0]).toMatchObject({ exerciseId: 'row', sets: 4 }));
  });

  it('a builder draft keeps ?builder=1 through the slot editor and back', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderPage(<ProgramDetailPage params={Promise.resolve({ id: program.id })} searchParams={Promise.resolve({ builder: '1' })} />);
    const links = await screen.findAllByRole('link');
    for (const l of links.filter((a) => a.getAttribute('href')?.includes('/session/'))) expect(l.getAttribute('href')).toMatch(/\?builder=1$/);

    document.body.innerHTML = '';
    await renderPage(
      <SessionEditorPage params={Promise.resolve({ id: program.id, sessionId: program.sessions[0].id })} searchParams={Promise.resolve({ builder: '1' })} />,
    );
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'prog_builder_back' }));
    expect(holder.push).toHaveBeenCalledWith(`/programs/${program.id}?builder=1`);
  });

  it('turning the smart filter back on resets a muscle it hides to ALL', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderPage(<SessionEditorPage params={Promise.resolve({ id: program.id, sessionId: program.sessions[0].id })} />);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    const dock = screen.getByTestId('live-load-dock');
    fireEvent.click(within(dock).getAllByRole('button', { name: 'prog_slot_load_bar' })[5]); // QUADS
    const smart = screen.getByRole('checkbox', { name: 'prog_slot_smart_filter' });
    expect(smart).not.toBeChecked();
    fireEvent.click(smart);
    const chips = screen.getByRole('group', { name: 'prog_slot_muscle_filter' });
    expect(within(chips).queryByRole('button', { name: 'prog_mus_quads' })).toBeNull();
    expect(within(chips).getByRole('button', { name: 'prog_mus_all' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('slot-empty')).toBeNull();
  });
});
