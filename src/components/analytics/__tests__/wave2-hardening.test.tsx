import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { ExerciseLookup } from '@/contracts/training';
import { loadCatalog } from '@/lib/catalog';
import { AcwrCard } from '../acwr-card';
import { acwrSummary } from '../analytics-math';
import { LineChart } from '../line-chart';
import { muscleVolumeKg } from '../muscle-volume';
import { exercise, logsAt, lookupOf, renderEn } from './helpers';

const none: ExerciseLookup = () => undefined;

describe('W2 S1: per-muscle volume never exceeds the kg lifted', () => {
  it('Smith drag curl 3 × 50 kg × 10 (1,500 kg moved) → Biceps ≤ 1,500 kg', async () => {
    const catalog = await loadCatalog();
    const lookup: ExerciseLookup = (id) => catalog.getById(id);
    const now = new Date(2026, 8, 26, 18, 0);
    const set = { kg: 50, reps: 10 };
    const logs = logsAt(now, [{ daysAgo: 1, exercises: [{ exerciseId: 'tytax_smith-machine_smith-drag-curl', sets: [set, set, set] }] }]);
    const got = muscleVolumeKg(logs, lookup);
    expect(got.Biceps).toBeGreaterThan(0);
    expect(got.Biceps).toBeLessThanOrEqual(1500);
  });

  it('two raw muscles standardising to Biceps (Biceps 92 + Brachialis 60) count once, at the higher score', () => {
    const now = new Date(2026, 8, 26, 18, 0);
    const logs = logsAt(now, [{ daysAgo: 1, exercises: [{ exerciseId: 'custom-curl', sets: [{ kg: 50, reps: 10 }] }] }]).map((l) => ({
      ...l,
      exercises: l.exercises.map((ex) => ({
        ...ex,
        muscleImpactSnapshot: [{ muscle: 'Biceps', score: 92 }, { muscle: 'Brachialis', score: 60 }],
      })),
    }));
    // 50 × 10 = 500 kg × 0.92 = 460 kg (not 500 × 1.52 = 760 kg)
    expect(muscleVolumeKg(logs, none).Biceps).toBeCloseTo(460, 6);
  });
});

const lookup = lookupOf([
  exercise('bench', [{ muscle: 'Chest', score: 100 }]),
  exercise('curl', [{ muscle: 'Biceps', score: 100 }], 'curl'),
]);
const bench = { exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }] };
const curl3 = { exerciseId: 'curl', sets: [{ kg: 20, reps: 10 }, { kg: 20, reps: 10 }, { kg: 20, reps: 10 }] };

describe('W2 S2: the ACWR zone is stable within a day', () => {
  it('four weekly Sunday 19:00 sessions: 18:30 and 20:05 the same evening give the same rows', () => {
    // Sessions start 18:00 and end 19:00 on Sundays 7, 14, 21 and 28 days before Sun 2026-09-27.
    const base = new Date(2026, 8, 27, 18, 0);
    const logs = logsAt(base, [7, 14, 21, 28].map((daysAgo) => ({ daysAgo, exercises: [bench] })));
    const early = acwrSummary(logs, lookup, new Date(2026, 8, 27, 18, 30));
    const late = acwrSummary(logs, lookup, new Date(2026, 8, 27, 20, 5));
    expect(early.building).toBe(false);
    expect(late).toEqual(early);
  });
});

describe('W2 S2: a muscle first trained this week is still building its own baseline', () => {
  // Sat 2026-09-26 18:00: bench weekly for 6 weeks (42 days of history), first-ever curl yesterday.
  const NOW = new Date(2026, 8, 26, 18, 0);
  const logs = logsAt(NOW, [
    ...[7, 14, 21, 28, 35, 42].map((daysAgo) => ({ daysAgo, exercises: [bench] })),
    { daysAgo: 1, exercises: [curl3] },
  ]);

  it('the Biceps row is building (no zone), Chest keeps its zone', () => {
    const s = acwrSummary(logs, lookup, NOW);
    expect(s.building).toBe(false);
    const biceps = s.rows.find((r) => r.muscle === 'Biceps')!;
    expect(biceps.building).toBe(true);
    expect(biceps.baselineDays).toBe(1);
    expect(s.rows.find((r) => r.muscle === 'Chest')!.building).toBe(false);
  });

  it('renders no "Danger" badge for Biceps, and a per-muscle building notice instead', () => {
    renderEn(<AcwrCard logs={logs} lookup={lookup} now={NOW} />);
    const row = screen.getByRole('row', { name: /Biceps/ });
    expect(within(row).queryByText('Danger')).toBeNull();
    expect(within(row).getByText('Building baseline: 1 of 28 days')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Chest/ })).queryByText('Building baseline', { exact: false })).toBeNull();
  });
});

describe('W2 S3: a chart without markBest never says "Best"', () => {
  it('bodyweight-style chart (82 → 80 → 78 kg)', () => {
    const points = [{ day: '2026-09-01', value: 82 }, { day: '2026-09-15', value: 80 }, { day: '2026-09-26', value: 78 }];
    const { container } = renderEn(<LineChart title="BW" points={points} format={(v) => `${v} kg`} markBest={false} />);
    expect(container.querySelector('figcaption')!.textContent).not.toMatch(/Best/);
    expect(screen.getByRole('img', { name: 'BW: first 82 kg, latest 78 kg' })).toBeInTheDocument();
  });

  it('a line chart with markBest still shows Best', () => {
    const points = [{ day: '2026-09-01', value: 100 }, { day: '2026-09-08', value: 120 }];
    const { container } = renderEn(<LineChart title="E1" points={points} format={(v) => `${v} kg`} />);
    expect(container.querySelector('figcaption')!.textContent).toMatch(/Best: 120 kg/);
  });
});
