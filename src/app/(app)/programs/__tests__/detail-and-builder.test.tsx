import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProgramTemplate } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));

const { default: ProgramDetailPage } = await import('../[id]/page-client');
const { default: NewProgramPage } = await import('../new/page-client');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`program-detail-${n}`) });
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
  sessionOrder: ['Upper', 'Lower'],
  sessions: [
    { id: 't1', programId: '', name: 'Upper', dayIndex: 0, exercises: [slot('bench'), slot('row'), slot('bench')] },
    { id: 't2', programId: '', name: 'Lower', dayIndex: 1, exercises: [slot('squat')] },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};

async function renderDetail(id: string) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ProgramDetailPage params={Promise.resolve({ id })} />
      </Suspense>,
    );
  });
}

describe('ProgramDetailPage', () => {
  it('activates, renames and edits a program through the repository', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderDetail(program.id);

    fireEvent.click(await screen.findByRole('button', { name: 'make_active' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(program.id));
    expect(await screen.findByText('training_active')).toBeInTheDocument();

    // The second "bench" slot (index 2) goes; the first one stays.
    const upper = screen.getByText('Upper').closest('div.overflow-hidden') as HTMLElement;
    const removeButtons = within(upper).getAllByRole('button', { name: 'delete' });
    // 3 slots in Upper → 3 remove buttons
    expect(removeButtons).toHaveLength(3);
    fireEvent.click(removeButtons[2]);
    await waitFor(async () =>
      expect((await repo.programs.get(me.id, program.id))?.sessions[0].exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']),
    );

    fireEvent.click(screen.getByTitle('click_to_edit'));
    const input = screen.getByLabelText('program_name');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(async () => expect((await repo.programs.get(me.id, program.id))?.name).toBe('Renamed'));
  });

  it('soft-deletes after confirmation and returns to the list', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE, { activate: true });
    await renderDetail(program.id);

    fireEvent.click(await screen.findByRole('button', { name: 'delete_program' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'delete' }));

    await waitFor(() => expect(holder.push).toHaveBeenCalledWith('/programs'));
    expect(await repo.programs.get(me.id, program.id)).toBeUndefined();
    // Deleting the active program clears the profile's pointer.
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull();
  });

  it('shows not-found for an unknown id', async () => {
    const repo = installRepo();
    await repo.profiles.ensureActive('Me');
    await renderDetail('missing');
    expect(await screen.findByText('program_not_found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'back_to_programs' }));
    expect(holder.push).toHaveBeenCalledWith('/programs');
  });
});

describe('NewProgramPage', () => {
  it('saves the builder output with repo.programs.create', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<NewProgramPage />);

    fireEvent.change(screen.getByLabelText('program_name'), { target: { value: 'KB Plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'modality_kettlebell' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    fireEvent.click(screen.getByRole('button', { name: 'push_pull_legs' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: 'review' }));
    const save = screen.getByRole('button', { name: 'save_program' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(holder.push).toHaveBeenCalledTimes(1));
    const [created] = await repo.programs.list(me.id);
    expect(holder.push).toHaveBeenCalledWith(`/programs/${created.id}`);
    expect(created.name).toBe('KB Plan');
    expect(created.modalitiesUsed).toEqual(['kettlebell']);
    // 6 days over push/pull/legs → 6 sessions, each re-parented to the new program
    expect(created.sessions).toHaveLength(6);
    expect(created.sessions.every((s) => s.programId === created.id)).toBe(true);
    // A builder program is not activated on save.
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull();
  });
});
