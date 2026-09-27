'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { Card, CardHeader } from '@/components/ui';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { weeklyVolume } from './analytics-math';
import { bestLifts } from './exercise-series';
import { dayLabel } from './labels';
import { LineChart } from './line-chart';
import { SectionTitle } from './section-title';

interface Props {
  logs: readonly WorkoutLog[];
  units: Units;
  now: Date;
}

/** Volume of the last 8 Monday-first weeks (empty weeks show as 0). */
export function WeeklyVolumeCard({ logs, units, now }: Props) {
  const { t, locale } = useT();
  const weeks = useMemo(() => weeklyVolume(logs, now, 8), [logs, now]);
  const fmt = (kg: number) => formatWeight(kg, units, locale);
  return (
    <Card>
      <section aria-labelledby="ana-weekly-title">
        <CardHeader>
          <SectionTitle id="ana-weekly-title">{t('ana_weekly_volume')}</SectionTitle>
        </CardHeader>
        <LineChart
          title={t('ana_weekly_volume')}
          variant="bar"
          points={weeks.map((w) => ({ day: w.weekStart, value: w.volumeKg }))}
          format={fmt}
        />
        <ul className="sr-only">
          {weeks.map((w) => (
            <li key={w.weekStart}>{t('ana_week_of', { date: dayLabel(w.weekStart, locale), volume: fmt(w.volumeKg) })}</li>
          ))}
        </ul>
      </section>
    </Card>
  );
}

interface LiftsProps {
  logs: readonly WorkoutLog[];
  units: Units;
  nameOf: (id: string, fallback?: string) => string;
  snapshotName: (id: string) => string | undefined;
}

/** Top 10 exercises by best e1RM; each links to its progress page. */
export function BestLiftsCard({ logs, units, nameOf, snapshotName }: LiftsProps) {
  const { t, locale } = useT();
  const lifts = useMemo(() => bestLifts(logs).slice(0, 10), [logs]);
  const fmt = (kg: number) => formatWeight(kg, units, locale);
  return (
    <Card>
      <section aria-labelledby="ana-lifts-title">
        <CardHeader>
          <SectionTitle id="ana-lifts-title">{t('ana_best_lifts')}</SectionTitle>
        </CardHeader>
        {lifts.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_no_data')}</p>
        ) : (
          <ul className="space-y-1" data-testid="ana-best-lifts">
            {lifts.map((l) => (
              <li key={l.exerciseId}>
                <Link
                  href={`/analytics/${encodeURIComponent(l.exerciseId)}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
                >
                  <span>
                    <span className="block text-sm font-medium text-fg">{nameOf(l.exerciseId, snapshotName(l.exerciseId))}</span>
                    <span className="block text-xs text-fg-2">
                      {t('ana_best_lift_row', { weight: fmt(l.kg), reps: l.reps, date: dayLabel(l.date, locale) })}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-base font-bold text-highlight">{fmt(l.e1rm)}</span>
                    <span className="block text-xs text-fg-muted">{t('ana_best_e1rm')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
