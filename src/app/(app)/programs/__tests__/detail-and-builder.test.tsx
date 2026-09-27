import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const { default: NewProgramPage } = await import('../new/page-client');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`program-detail-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  holder.replace.mockClear();
  return repo;
}

afterEach(() => {
  vi.useRealTimers();
});

const slot = (exerciseId: string) => ({ exerciseId, exerciseName: exerciseId.toUpperCase(), modality: 'tytax' as const, sets: 3, reps: '8-12' });

const TEMPLATE: ProgramTemplate = {
  name: 'Split',
  splitType: 'upper_lower',
  frequency: 2,
  periodizationType: 'none',
  sessionOrder: ['Upper A', 'Lower A', 'Rest'],
  sessions: [
    { id: 't1', programId: '', name: 'Upper A', dayIndex: 0, exercises: [slot('bench'), slot('row'), slot('bench')] },
    { id: 't2', programId: '', name: 'Lower A', dayIndex: 1, exercises: [slot('squat')] },
    { id: 't3', programId: '', name: 'Rest', dayIndex: 2, exercises: [], isRest: true },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};

async function renderDetail(id: string, search: Record<string, string> = {}) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ProgramDetailPage params={Promise.resolve({ id })} searchParams={Promise.resolve(search)} />
      </Suspense>,
    );
  });
}

const rotation = () => screen.getByTestId('rotation-list');
const rotationNames = () => within(rotation()).getAllByRole('listitem').map((li) => li.textContent ?? '');

describe('NewProgramPage (builder wizard)', () => {
  it('days → split persists an inactive program with legacy slot names and a rest day, then opens the manager', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<NewProgramPage />);
    expect(screen.getByTestId('page-heading-program-new')).toBeInTheDocument();
    const dayButtons = screen.getAllByRole('button', { name: 'prog_builder_days_n' });
    expect(dayButtons.map((b) => b.textContent)).toEqual(['2', '3', '4', '5', '6']);
    fireEvent.click(dayButtons[3]); // 5 days
    // 5 days → PPL, UL recommended, Full body under "Other"
    const options = screen.getAllByRole('button').filter((b) => b.textContent?.includes('prog_split_'));
    expect(options.map((b) => b.textContent?.match(/prog_split_[a-z_]+?(?=[A-Z]|$)/)?.[0])).toEqual(['prog_split_push_pull_legs', 'prog_split_upper_lower', 'prog_split_full_body']);
    await waitFor(() => expect(options[0]).toBeEnabled());
    fireEvent.click(options[0]);
    await waitFor(() => expect(holder.replace).toHaveBeenCalledTimes(1));
    const [program] = await repo.programs.list(me.id);
    expect(holder.replace).toHaveBeenCalledWith(`/programs/${program.id}?builder=1`);
    expect(program.sessions.map((s) => s.name)).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'prog_rest_day']);
    expect(program.sessions[5].isRest).toBe(true);
    expect(program).toMatchObject({ splitType: 'push_pull_legs', frequency: 5, currentSessionIndex: 0, isPreset: false });
    expect(program.rotationStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull();
  });
});

describe('ProgramDetailPage', () => {
  it('shows not-found for an unknown id, another profile\'s program and a deleted one', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const other = await repo.profiles.create({ name: 'Other' });
    const theirs = await repo.programs.create(other.id, TEMPLATE);
    const gone = await repo.programs.create(me.id, TEMPLATE);
    await repo.programs.softDelete(me.id, gone.id);
    for (const id of ['nope', theirs.id, gone.id]) {
      await renderDetail(id);
      expect(await screen.findByText('prog_detail_not_found')).toBeInTheDocument();
      expect(screen.getByTestId('page-heading-program-detail')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'prog_detail_back' })).toHaveAttribute('href', '/programs');
      document.body.innerHTML = '';
    }
  });

  it('renames (Enter saves, Esc cancels) and gates activation on completeness', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderDetail(program.id);
    expect(await screen.findByTestId('page-heading-program-detail')).toHaveTextContent('Split');

    fireEvent.click(screen.getByRole('button', { name: 'prog_rename' }));
    const input = screen.getByRole('textbox', { name: 'prog_name_label' });
    fireEvent.change(input, { target: { value: 'Ignored' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'prog_rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'prog_name_label' }), { target: { value: '  Renamed  ' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'prog_name_label' }), { key: 'Enter' });
    await waitFor(async () => expect((await repo.programs.get(me.id, program.id))?.name).toBe('Renamed'));

    fireEvent.click(screen.getByRole('button', { name: 'prog_activate' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBe(program.id));
    // Now active → deactivate with confirmation
    fireEvent.click(await screen.findByRole('button', { name: 'prog_deactivate' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_deactivate' }));
    await waitFor(async () => expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull());
  });

  it('disables Activate while a training day is empty', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const empty = { ...TEMPLATE, sessions: TEMPLATE.sessions.map((s) => (s.id === 't2' ? { ...s, exercises: [] } : s)) };
    const program = await repo.programs.create(me.id, empty);
    await renderDetail(program.id);
    expect(await screen.findByRole('button', { name: 'prog_activate' })).toBeDisabled();
    expect(screen.getByText('prog_incomplete_hint')).toBeInTheDocument();
    // the empty day links to its slot editor
    const t2 = program.sessions[1];
    expect(screen.getByRole('link', { name: 'prog_slot_empty' })).toHaveAttribute('href', `/programs/${program.id}/session/${t2.id}`);
  });

  it('removes a duplicate slot by index and edits sets/reps inline', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderDetail(program.id);
    const removes = await screen.findAllByRole('button', { name: 'prog_slot_remove' });
    fireEvent.click(removes[2]); // the second BENCH
    await waitFor(async () =>
      expect((await repo.programs.get(me.id, program.id))?.sessions[0].exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row']),
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'prog_edit_named' })[1]); // ROW
    const reps = screen.getByRole('textbox', { name: 'prog_reps' });
    fireEvent.change(reps, { target: { value: '8-' } });
    expect(screen.getByRole('button', { name: 'prog_done' })).toBeDisabled();
    fireEvent.change(reps, { target: { value: '10/side' } });
    const setsGroup = screen.getByRole('group', { name: 'prog_sets' });
    fireEvent.click(within(setsGroup).getAllByRole('button')[1]); // + 1 set: 3 → 4
    fireEvent.click(screen.getByRole('button', { name: 'prog_done' }));
    await waitFor(async () => {
      const row = (await repo.programs.get(me.id, program.id))?.sessions[0].exercises[1];
      expect(row).toMatchObject({ exerciseId: 'row', sets: 4, reps: '10/side' });
    });
  });

  it('reorders the rotation keeping the pointer, sets the next session, adds/removes rest days', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, { ...TEMPLATE, currentSessionIndex: 1 }); // next = Lower A
    await renderDetail(program.id);
    await screen.findByTestId('rotation-list');
    fireEvent.click(within(rotation()).getAllByRole('button', { name: 'prog_move_up_named' })[1]); // Lower A up
    await waitFor(async () => {
      const p = await repo.programs.get(me.id, program.id);
      expect(p?.sessions.map((s) => s.name)).toEqual(['Lower A', 'Upper A', 'Rest']);
      expect(p?.currentSessionIndex).toBe(0); // still Lower A
      expect(p?.sessionOrder).toEqual(['Lower A', 'Upper A', 'Rest']);
    });

    fireEvent.click(within(rotation()).getAllByRole('button', { name: 'prog_rotation_set_next_named' })[1]); // Rest (index 2)
    await waitFor(async () => expect((await repo.programs.get(me.id, program.id))?.currentSessionIndex).toBe(2));

    fireEvent.click(screen.getByRole('button', { name: 'prog_rest_add' }));
    await waitFor(() => expect(rotationNames()).toHaveLength(4));
    fireEvent.click(within(rotation()).getAllByRole('button', { name: 'prog_rest_remove' })[0]); // remove the pointed Rest
    await waitFor(async () => {
      const p = await repo.programs.get(me.id, program.id);
      expect(p?.sessions.map((s) => s.name)).toEqual(['Lower A', 'Upper A', 'prog_rest_day']);
      expect(p?.currentSessionIndex).toBe(2); // moved to the successor that took its place
    });
  });

  it('adds a training day before the rest day and removes one after confirmation (frequency follows)', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE); // Upper A, Lower A, Rest; 2 days
    await renderDetail(program.id);
    await screen.findByTestId('rotation-list');
    fireEvent.click(screen.getByRole('button', { name: 'prog_day_add' }));
    await waitFor(async () => {
      const p = await repo.programs.get(me.id, program.id);
      expect(p?.sessions.map((s) => [s.name, !!s.isRest])).toEqual([['Upper A', false], ['Lower A', false], ['prog_day_n', false], ['Rest', true]]);
      expect(p?.frequency).toBe(3);
    });
    // the new empty day makes the program incomplete and appears as a card linking to its slot editor
    expect(await screen.findByRole('button', { name: 'prog_activate' })).toBeDisabled();
    expect(screen.getAllByTestId('session-card')).toHaveLength(3);

    // remove Upper A (index 0): cancel first, then confirm
    fireEvent.click(within(rotation()).getAllByRole('button', { name: 'prog_day_remove_named' })[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_cancel' }));
    expect((await repo.programs.get(me.id, program.id))?.sessions).toHaveLength(4);
    fireEvent.click(within(rotation()).getAllByRole('button', { name: 'prog_day_remove_named' })[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_delete' }));
    await waitFor(async () => {
      const p = await repo.programs.get(me.id, program.id);
      expect(p?.sessions.map((s) => s.name)).toEqual(['Lower A', 'prog_day_n', 'Rest']);
      expect(p?.frequency).toBe(2);
      expect(p?.currentSessionIndex).toBe(0); // pointer was on Upper A → Lower A took its place
    });
  });

  it('session rename: Esc cancels without saving, Enter saves once', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    const update = vi.spyOn(repo.programs, 'update');
    await renderDetail(program.id);
    fireEvent.click((await screen.findAllByRole('button', { name: 'prog_rename_named' }))[0]);
    let input = screen.getByRole('textbox', { name: 'prog_session_name_label' });
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    fireEvent.click(screen.getAllByRole('button', { name: 'prog_rename_named' })[0]);
    input = screen.getByRole('textbox', { name: 'prog_session_name_label' });
    fireEvent.change(input, { target: { value: 'Upper Heavy' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    await waitFor(async () => expect((await repo.programs.get(me.id, program.id))?.sessions[0].name).toBe('Upper Heavy'));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('aligns the pointer to the rotation start date with the calendar formula', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 12, 0)); // local 2026-09-26
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE);
    await renderDetail(program.id);
    const date = await screen.findByLabelText('prog_rotation_start');
    // start 2026-09-21, today 26 → diff 5 → 5 % 3 sessions = 2 → Rest
    fireEvent.change(date, { target: { value: '2026-09-21' } });
    fireEvent.click(screen.getByRole('button', { name: 'prog_rotation_sync' }));
    await waitFor(async () => {
      const p = await repo.programs.get(me.id, program.id);
      expect(p?.currentSessionIndex).toBe(2);
      expect(p?.rotationStartDate).toBe('2026-09-21');
    });
  });

  it('deletes after confirmation; a builder draft offers discard instead', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE, { activate: true });
    await renderDetail(program.id);
    fireEvent.click(await screen.findByRole('button', { name: 'prog_detail_delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_delete' }));
    await waitFor(() => expect(holder.replace).toHaveBeenCalledWith('/programs'));
    expect(await repo.programs.list(me.id)).toHaveLength(0);
    expect((await repo.profiles.get(me.id))?.activeProgramId).toBeNull();

    document.body.innerHTML = '';
    const draft = await repo.programs.create(me.id, TEMPLATE);
    await renderDetail(draft.id, { builder: '1' });
    expect(screen.queryByRole('button', { name: 'prog_detail_delete' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'prog_builder_discard' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_builder_discard' }));
    await waitFor(async () => expect(await repo.programs.list(me.id)).toHaveLength(0));
  });
});
