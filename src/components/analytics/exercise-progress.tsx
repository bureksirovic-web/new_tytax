'use client';
import { useMemo } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { e1rmPoints, exerciseSeries } from './exercise-series';
import { e1rmMaxReps } from './g1-adapters';
import { dayLabel, sessionsLabel } from './labels';
import { LineChart } from './line-chart';

interface Props {
  logs: readonly WorkoutLog[];
  exerciseId: string;
  units: Units;
  /** Heading level of the chart titles (h2 on the detail page, h3 inside a card). */
  headingLevel?: 'h2' | 'h3';
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-bg-2 p-3">
      <dt className="text-xs uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className="font-display text-xl font-bold text-fg">{value}</dd>
      {sub && <dd className="text-xs text-fg-2">{sub}</dd>}
    </div>
  );
}

/** e1RM, top-set weight and volume per session for one exercise, in the profile's units. */
export function ExerciseProgress({ logs, exerciseId, units, headingLevel: H = 'h3' }: Props) {
  const { t, locale } = useT();
  const points = useMemo(() => exerciseSeries(logs, exerciseId), [logs, exerciseId]);
  const fmt = (kg: number) => formatWeight(kg, units, locale);

  if (points.length === 0) {
    return <p className="text-sm text-fg-muted" data-testid="ana-no-history">{t('ana_no_history')}</p>;
  }
  const ranked = e1rmPoints(points);
  const best = ranked.length ? ranked.reduce((a, b) => (b.e1rm > a.e1rm ? b : a)) : null;
  const latest = ranked.at(-1);
  const prev = ranked.at(-2);
  const delta = latest && prev ? latest.e1rm - prev.e1rm : null;
  const sign = delta !== null && delta > 0 ? '+' : delta !== null && delta < 0 ? '−' : '';
  const titleCls = 'mb-2 font-display text-sm font-semibold uppercase tracking-wider text-fg-2';

  return (
    <div className="space-y-4" data-testid="ana-exercise-progress">
      {best && latest ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat
            label={t('ana_best_e1rm')}
            value={fmt(best.e1rm)}
            sub={t('ana_best_lift_row', { weight: fmt(best.bestKg), reps: best.bestReps, date: dayLabel(best.date, locale) })}
          />
          <Stat label={t('ana_latest')} value={fmt(latest.e1rm)} sub={sessionsLabel(t, locale, ranked.length)} />
          {delta !== null && <Stat label={t('ana_change')} value={`${sign}${fmt(Math.abs(delta))}`} />}
        </dl>
      ) : null}
      <section>
        <H className={titleCls}>{t('ana_e1rm_progress')}</H>
        {ranked.length ? (
          <LineChart title={t('ana_e1rm_progress')} points={ranked.map((p) => ({ day: p.date, value: p.e1rm }))} format={fmt} />
        ) : (
          <p className="text-sm text-fg-muted" data-testid="ana-e1rm-none">
            {t('ana_e1rm_none', { n: e1rmMaxReps() })}
          </p>
        )}
      </section>
      <section>
        <H className={titleCls}>{t('ana_top_set')}</H>
        <LineChart title={t('ana_top_set')} points={points.map((p) => ({ day: p.date, value: p.topKg }))} format={fmt} />
      </section>
      <section>
        <H className={titleCls}>{t('ana_session_volume')}</H>
        <LineChart
          title={t('ana_session_volume')}
          variant="bar"
          points={points.map((p) => ({ day: p.date, value: p.volumeKg }))}
          format={fmt}
        />
      </section>
    </div>
  );
}
