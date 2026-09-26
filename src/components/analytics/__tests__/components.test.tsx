import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { AcwrCard } from '../acwr-card';
import { ExerciseInspector } from '../exercise-inspector';
import { LineChart } from '../line-chart';
import { MuscleDistribution } from '../muscle-distribution';
import { PinnedEditor } from '../pinned-editor';
import { TrainingHeatmap } from '../training-heatmap';
import { exercise, logsAt, lookupOf, renderEn } from './helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
const { BodyweightCard } = await import('../bodyweight-card');

const NOW = new Date(2026, 8, 26, 18, 0);
const lookup = lookupOf([
  exercise('bench', [{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }]),
  exercise('squat', [{ muscle: 'Quads', score: 100 }], 'squat'),
]);
const bench = { exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }] };
const squat = { exerciseId: 'squat', sets: [{ kg: 80, reps: 5 }] };

let n = 0;
async function setup(units: 'kg' | 'lb'): Promise<{ repo: Repository; profileId: string }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-ui-${n}`) });
  holder.repo = repo;
  const p = await repo.profiles.ensureActive('Me');
  await repo.profiles.updateSettings(p.id, { units });
  return { repo, profileId: p.id };
}

describe('LineChart', () => {
  const fmt = (v: number) => `${v} kg`;
  it('renders 0, 1 and n points with a text summary', () => {
    const { unmount } = renderEn(<LineChart title="E1" points={[]} format={fmt} />);
    expect(screen.getByText('E1: no data')).toBeInTheDocument();
    unmount();
    const one = renderEn(<LineChart title="E1" points={[{ day: '2026-09-20', value: 100 }]} format={fmt} />);
    expect(screen.getByRole('img', { name: 'E1: one value, 100 kg' })).toBeInTheDocument();
    expect(one.container.querySelectorAll('circle')).toHaveLength(1);
    one.unmount();
    const many = renderEn(
      <LineChart title="E1" points={[{ day: '2026-09-01', value: 100 }, { day: '2026-09-08', value: 120 }, { day: '2026-09-15', value: 110 }]} format={fmt} />,
    );
    expect(screen.getByRole('img', { name: 'E1: first 100 kg, latest 110 kg, best 120 kg' })).toBeInTheDocument();
    expect(many.container.querySelectorAll('circle')).toHaveLength(3);
    expect(many.container.querySelector('polyline')).not.toBeNull();
  });
});

describe('AcwrCard', () => {
  it('shows only acute load while the baseline builds (no zone badge)', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench] }, { daysAgo: 10, exercises: [bench] }]);
    renderEn(<AcwrCard logs={logs} lookup={lookup} now={NOW} />);
    expect(screen.getByTestId('ana-acwr-building')).toHaveTextContent('Building baseline: 10 of 28 days');
    expect(screen.queryByText('Danger')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Ratio' })).toBeNull();
  });

  it('shows ratio and zone once 28 days of history exist', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench] }, { daysAgo: 10, exercises: [bench] }, { daysAgo: 40, exercises: [bench] }]);
    renderEn(<AcwrCard logs={logs} lookup={lookup} now={NOW} />);
    // Chest: acute 2, chronic (2+2)/4 = 1 → ratio 2 → danger
    const row = screen.getByRole('row', { name: /Chest/ });
    expect(within(row).getByText('Danger')).toBeInTheDocument();
    // cells: acute 2, chronic 1, ratio 2
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['2', '1', '2', 'Danger']);
    expect(screen.queryByTestId('ana-acwr-building')).toBeNull();
  });

  it('no training in 28 days → a plain message', () => {
    renderEn(<AcwrCard logs={logsAt(NOW, [{ daysAgo: 60, exercises: [bench] }])} lookup={lookup} now={NOW} />);
    expect(screen.getByText('No training in the last 28 days.')).toBeInTheDocument();
  });
});

describe('MuscleDistribution', () => {
  it('switching the window actually changes the list, and the lagging muscle is named', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench] }, { daysAgo: 20, exercises: [squat] }]);
    renderEn(<MuscleDistribution logs={logs} lookup={lookup} now={NOW} />);
    const list = () => screen.getByTestId('ana-distribution-list');
    // default: last 20 sessions → Chest 2, Quads 1, Triceps 1 of 4
    expect(within(list()).getByText('Quads')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(within(list()).queryByText('Quads')).toBeNull();
    // Chest 2 of 3 sets-weight → 66.7 %
    expect(within(list()).getByText('66.7% of load')).toBeInTheDocument();
    expect(screen.getByText('Lagging muscle: Quads')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show exercises' })).toHaveAttribute('href', '/exercises?muscle=Quads');
  });
});

describe('TrainingHeatmap', () => {
  it('summarises trained days and labels each day', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench] }, { daysAgo: 3, deleted: true, exercises: [bench] }]);
    const { container } = renderEn(<TrainingHeatmap logs={logs} now={NOW} units="lb" />);
    // 84 cells, Sunday 2026-09-27 is still ahead → 83 past days
    expect(screen.getByTestId('ana-heatmap-summary')).toHaveTextContent('Trained on 1 of 83 days in the last 12 weeks');
    expect(container.querySelector('[data-day="2026-09-24"]')).toHaveAttribute('data-level', '4');
    expect(container.querySelector('[data-day="2026-09-23"]')).toHaveAttribute('data-level', '0');
    // 1000 kg × 2.20462 = 2204.6 lb
    expect(screen.getByText(/sessions 1, volume 2,204\.6 lb/)).toBeInTheDocument();
  });
});

describe('PinnedEditor', () => {
  it('caps the selection at 4 and saves exercise ids', () => {
    const onSave = vi.fn();
    const exercises = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `Ex ${id}` }));
    renderEn(<PinnedEditor open initial={['a']} exercises={exercises} max={4} onSave={onSave} onClose={() => {}} />);
    for (const name of ['Ex b', 'Ex c', 'Ex d']) fireEvent.click(screen.getByLabelText(name));
    expect(screen.getByLabelText('Ex e')).toBeDisabled();
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(['a', 'b', 'c', 'd']);
  });
});

describe('BodyweightCard', () => {
  it('adds an entry in lb (stored as kg), rejects invalid input, and deletes', async () => {
    const { repo, profileId } = await setup('lb');
    renderEn(<BodyweightCard profileId={profileId} units="lb" />);
    const input = await screen.findByLabelText('Bodyweight (lb)');

    for (const bad of ['0', '1200', 'abc']) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      // 20 kg = 44.1 lb, 400 kg = 881.8 lb
      expect(await screen.findByText('Enter a weight between 44.1 lb and 881.8 lb')).toBeInTheDocument();
    }
    expect(await repo.bodyweight.list(profileId)).toEqual([]);

    fireEvent.change(input, { target: { value: '176.4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // 176.4 / 2.20462 = 80.01 kg stored; shown back as 80.01 × 2.20462 = 176.4 lb
    await waitFor(async () => expect((await repo.bodyweight.list(profileId)).map((e) => e.valueKg)).toEqual([80.01]));
    const list = await screen.findByTestId('ana-bw-list');
    expect(within(list).getByText('176.4 lb')).toBeInTheDocument();
    expect((await repo.profiles.get(profileId))!.bodyweightKg).toBe(80.01);

    fireEvent.click(within(list).getByRole('button', { name: /Delete entry from/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete entry from/ }));
    await waitFor(() => expect(screen.getByText('No bodyweight entries yet.')).toBeInTheDocument());
    expect(await repo.bodyweight.list(profileId)).toEqual([]);
  });

  it('edits an existing entry in place', async () => {
    const { repo, profileId } = await setup('kg');
    await repo.bodyweight.add(profileId, { date: '2026-09-01', valueKg: 82 });
    renderEn(<BodyweightCard profileId={profileId} units="kg" />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit entry from/ }));
    const input = screen.getByLabelText('Bodyweight (kg)');
    expect(input).toHaveValue('82');
    fireEvent.change(input, { target: { value: '81,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update entry' }));
    await waitFor(async () => expect((await repo.bodyweight.list(profileId)).map((e) => [e.date, e.valueKg])).toEqual([['2026-09-01', 81.5]]));
  });

  it('in lb, editing only the date keeps the stored kg exactly (no 80 → 80.01 drift)', async () => {
    const { repo, profileId } = await setup('lb');
    await repo.bodyweight.add(profileId, { date: '2026-09-01', valueKg: 80 });
    renderEn(<BodyweightCard profileId={profileId} units="lb" />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit entry from/ }));
    // 80 × 2.20462 = 176.37 → shown as 176.4; 176.4 / 2.20462 would be 80.01
    expect(screen.getByLabelText('Bodyweight (lb)')).toHaveValue('176.4');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update entry' }));
    await waitFor(async () => expect((await repo.bodyweight.list(profileId)).map((e) => [e.date, e.valueKg])).toEqual([['2026-09-02', 80]]));
  });
});

describe('ExerciseInspector', () => {
  it('links to /exercises/[id] only for catalog exercises (custom ones have no page)', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench, { exerciseId: 'my-custom', sets: [{ kg: 10, reps: 10 }] }] }]);
    const exercises = [{ id: 'bench', name: 'Bench' }, { id: 'my-custom', name: 'Custom' }];
    renderEn(<ExerciseInspector logs={logs} exercises={exercises} units="kg" inCatalog={(id) => lookup(id) !== undefined} />);
    expect(screen.getByRole('link', { name: 'Exercise details' })).toHaveAttribute('href', '/exercises/bench');
    fireEvent.change(screen.getByLabelText('Choose exercise'), { target: { value: 'my-custom' } });
    expect(screen.queryByRole('link', { name: 'Exercise details' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open full progress' })).toHaveAttribute('href', '/analytics/my-custom');
  });
});
