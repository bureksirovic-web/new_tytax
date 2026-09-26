import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Exercise, Program, ProgramTemplate } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { loadCatalog } from '@/lib/catalog';
import { matchesAttachment } from '@/lib/catalog/query';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push, replace: holder.replace }) }));

const { default: SessionEditorPage } = await import('../[id]/session/[sessionId]/page-client');

let n = 0;
async function setup(): Promise<{ repo: Repository; profileId: string; program: Program }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`program-session-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  const me = await repo.profiles.ensureActive('Me');
  const program = await repo.programs.create(me.id, TEMPLATE);
  return { repo, profileId: me.id, program };
}

const TEMPLATE: ProgramTemplate = {
  name: 'UL',
  splitType: 'upper_lower',
  frequency: 2,
  periodizationType: 'none',
  sessionOrder: ['Upper A', 'Lower A', 'Rest'],
  sessions: [
    {
      id: 'u',
      programId: '',
      name: 'Upper A',
      dayIndex: 0,
      exercises: [{ exerciseId: 'tytax_back-upper-pulley_upper-pulley-face-pull-rope', exerciseName: 'Face Pull', modality: 'tytax', sets: 5, reps: '15-20', restSeconds: 45 }],
    },
    { id: 'l', programId: '', name: 'Lower A', dayIndex: 1, exercises: [] },
    { id: 'r', programId: '', name: 'Rest', dayIndex: 2, exercises: [], isRest: true },
  ],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};

async function open(id: string, sessionId: string) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <SessionEditorPage params={Promise.resolve({ id, sessionId })} />
      </Suspense>,
    );
  });
}

const chipGroup = () => screen.getByRole('group', { name: 'prog_slot_muscle_filter' });
const search = (text: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });
const cards = () => within(screen.getByTestId('slot-results')).getAllByRole('button');

describe('SessionEditorPage (slot editor)', () => {
  it('shows not-found for an unknown session and for a rest day', async () => {
    const { program } = await setup();
    await open(program.id, 'nope');
    expect(await screen.findByText('prog_slot_not_found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'prog_detail_back' })).toHaveAttribute('href', `/programs/${program.id}`);
    document.body.innerHTML = '';
    await open(program.id, program.sessions[2].id);
    expect(await screen.findByText('prog_slot_not_found')).toBeInTheDocument();
  });

  it('smart filter hides leg chips on an upper day; chips, station and search actually filter', async () => {
    const { program } = await setup();
    await open(program.id, program.sessions[0].id);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    expect(screen.getByTestId('page-heading-program-session')).toHaveTextContent('Upper A');
    expect(within(chipGroup()).queryByRole('button', { name: 'prog_mus_quads' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'prog_slot_smart_filter' }));
    expect(within(chipGroup()).getByRole('button', { name: 'prog_mus_quads' })).toBeInTheDocument();

    fireEvent.click(within(chipGroup()).getByRole('button', { name: 'prog_mus_chest' }));
    // every visible card is a chest exercise (label key rendered in the card)
    expect(cards().length).toBeGreaterThan(0);
    for (const c of cards().filter((b) => b.hasAttribute('aria-pressed'))) expect(c).toHaveTextContent('prog_mus_chest');

    fireEvent.click(within(screen.getByRole('group', { name: 'prog_slot_station_filter' })).getByRole('button', { name: 'prog_station_smith' }));
    for (const c of cards().filter((b) => b.hasAttribute('aria-pressed'))) expect(c).toHaveTextContent('prog_station_smith');

    search('smith flat bench');
    await waitFor(() => expect(cards().filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(1), { timeout: 2000 });
    expect(cards()[0]).toHaveTextContent('Smith Flat Bench Press');
  });

  it('toggles exercises by id and saves: existing prescriptions kept, new ones get catalog defaults', async () => {
    const { repo, profileId, program } = await setup();
    await open(program.id, program.sessions[0].id);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    search('smith flat bench');
    const bench = await screen.findByRole('button', { name: 'prog_slot_add' }, { timeout: 2000 });
    fireEvent.click(bench);
    expect(bench).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('live-load-dock')).toHaveTextContent('prog_slot_selected');
    fireEvent.click(screen.getByRole('button', { name: 'prog_slot_save' }));
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith(`/programs/${program.id}`));
    const saved = (await repo.programs.get(profileId, program.id))?.sessions[0].exercises;
    expect(saved?.map((e) => e.exerciseId)).toEqual(['tytax_back-upper-pulley_upper-pulley-face-pull-rope', 'tytax_smith-machine_smith-flat-bench-press']);
    expect(saved?.[0]).toMatchObject({ sets: 5, reps: '15-20', restSeconds: 45 });
    // catalog defaults for Smith Flat Bench Press: 3 × 6-10
    expect(saved?.[1]).toMatchObject({ sets: 3, reps: '6-10', exerciseName: 'Smith Flat Bench Press', modality: 'tytax' });
  });

  it('saving keeps a deliberately repeated exercise with its own prescriptions', async () => {
    const { repo, profileId, program } = await setup();
    const face = program.sessions[0].exercises[0];
    const sessions = program.sessions.map((s, i) => (i === 0 ? { ...s, exercises: [face, { ...face, sets: 2, reps: '12' }] } : s));
    await repo.programs.update(profileId, program.id, { sessions });
    await open(program.id, program.sessions[0].id);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'prog_slot_save' }));
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith(`/programs/${program.id}`));
    const saved = (await repo.programs.get(profileId, program.id))?.sessions[0].exercises;
    expect(saved?.map((e) => [e.sets, e.reps])).toEqual([[5, '15-20'], [2, '12']]);
  });

  it('"only my equipment" follows the profile inventory', async () => {
    // Ids and requirements come from the loaded catalog, never literals (they differ between catalog builds).
    const catalog = await loadCatalog();
    const requires = (ex: Exercise) => ex.attachmentIds ?? catalog.attachments.filter((a) => matchesAttachment(ex, a.id)).map((a) => a.id);
    const facePulls = catalog.exercises.filter((e) => e.modality === 'tytax' && /face pull/i.test(e.name));
    const ropePull = catalog.getById('tytax_back-upper-pulley_upper-pulley-face-pull-rope');
    const rope = ropePull ? requires(ropePull)[0] : undefined;
    expect(rope).toBeDefined();
    // Owning one attachment no face pull needs: only the face pulls without a (non-owned) requirement stay.
    const other = catalog.attachments.find((a) => !facePulls.some((e) => requires(e).includes(a.id)))?.id;
    expect(other).toBeDefined();
    const ownedWith = (ids: readonly string[]) => facePulls.filter((e) => requires(e).every((a) => ids.includes(a))).map((e) => e.name).sort();
    const withoutRope = ownedWith([other!]);
    expect(withoutRope.length).toBeLessThan(facePulls.length); // the rope face pull at least is hidden
    expect(ownedWith([other!, rope!])).toEqual(facePulls.map((e) => e.name).sort());

    const { repo, profileId, program } = await setup();
    await repo.equipment.save(profileId, { attachmentIds: [other!] });
    await open(program.id, program.sessions[0].id);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    search('face pull');
    const shownNames = () => cards().map((b) => b.querySelector('span > span')?.textContent ?? '').sort();
    await waitFor(() => expect(shownNames()).toEqual(facePulls.map((e) => e.name).sort()), { timeout: 2000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'prog_slot_owned_only' }));
    if (withoutRope.length === 0) {
      expect(await screen.findByTestId('slot-empty')).toHaveTextContent('prog_slot_no_matches');
    } else {
      await waitFor(() => expect(shownNames()).toEqual(withoutRope));
    }
    await act(async () => {
      await repo.equipment.save(profileId, { attachmentIds: [other!, rope!] });
    });
    await waitFor(() => expect(shownNames()).toEqual(facePulls.map((e) => e.name).sort()));
  });

  it('asks before leaving with unsaved changes', async () => {
    const { program } = await setup();
    await open(program.id, program.sessions[0].id);
    await screen.findByTestId('slot-results', undefined, { timeout: 5000 });
    // deselect the existing face pull → dirty
    search('upper pulley face pull');
    fireEvent.click(await screen.findByRole('button', { name: 'prog_slot_remove' }, { timeout: 2000 }));
    fireEvent.click(screen.getByRole('button', { name: 'prog_builder_back' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'prog_cancel' }));
    expect(holder.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'prog_builder_back' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'prog_slot_leave' }));
    expect(holder.push).toHaveBeenCalledWith(`/programs/${program.id}`);
  });
});
