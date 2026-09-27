'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { Card, CardHeader, FilterChips } from '@/components/ui';
import { SectionTitle } from './section-title';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { DISTRIBUTION_WINDOWS, muscleDistribution, type DistributionWindow } from './analytics-math';
import { exercisesHrefForMuscle, muscleLabel, num, WINDOW_KEYS } from './labels';
import '@/lib/i18n/packs/analytics';

interface Props {
  logs: readonly WorkoutLog[];
  lookup: ExerciseLookup;
  now: Date;
  /** Display unit for the per-muscle volume (default kg). */
  units?: Units;
}

const TOP_N = 5;

export function MuscleDistribution({ logs, lookup, now, units = 'kg' }: Props) {
  const { t, locale } = useT();
  const [range, setRange] = useState<DistributionWindow>('20s');
  const [showAll, setShowAll] = useState(false);
  const { shares, lagging } = useMemo(() => muscleDistribution(logs, lookup, range, now), [logs, lookup, range, now]);
  const visible = showAll ? shares : shares.slice(0, TOP_N);
  const top = shares[0]?.share ?? 1;
  const pct = (share: number) => num(share * 100, locale, 1);
  const laggingHref = lagging ? exercisesHrefForMuscle(lagging.muscle) : undefined;

  return (
    <Card>
      <section aria-labelledby="ana-distribution-title">
        <CardHeader>
          <SectionTitle id="ana-distribution-title">{t('ana_growth_focus')}</SectionTitle>
        </CardHeader>
        <FilterChips
          className="mb-3"
          ariaLabel={t('ana_window_label')}
          multi={false}
          options={DISTRIBUTION_WINDOWS.map((w) => ({ value: w, label: t(WINDOW_KEYS[w]) }))}
          selected={[range]}
          onChange={(next) => next[0] && setRange(next[0])}
        />
        {shares.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_no_data')}</p>
        ) : (
          <>
            <ul className="space-y-2" data-testid="ana-distribution-list">
              {visible.map((m) => (
                <li key={m.muscle}>
                  <div className="mb-0.5 flex justify-between gap-2 text-xs">
                    <span className="font-medium text-fg">{muscleLabel(t, m.muscle)}</span>
                    <span className="text-fg-2">
                      {m.volumeKg > 0
                        ? t('ana_share_volume', { pct: pct(m.share), volume: formatWeight(m.volumeKg, units, locale) })
                        : t('ana_share', { pct: pct(m.share) })}
                    </span>
                  </div>
                  <svg className="h-1.5 w-full" aria-hidden="true">
                    <rect width="100%" height="100%" rx={3} className="fill-line" />
                    <rect width={`${(m.share / top) * 100}%`} height="100%" rx={3} className="fill-accent" />
                  </svg>
                </li>
              ))}
            </ul>
            {shares.length > TOP_N && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="mt-2 min-h-11 rounded-lg px-2 text-sm text-highlight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
              >
                {showAll ? t('ana_show_less') : t('ana_show_all', { count: shares.length })}
              </button>
            )}
            <div className="mt-3 border-t border-line pt-3" role="status">
              {lagging ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-highlight">{t('ana_lagging', { muscle: muscleLabel(t, lagging.muscle) })}</p>
                    <p className="text-xs text-fg-2">
                      {t('ana_lagging_detail', { actual: pct(lagging.actualShare), target: pct(lagging.targetShare) })}
                    </p>
                  </div>
                  {laggingHref && (
                    <Link
                      href={laggingHref}
                      className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
                    >
                      {t('ana_lagging_cta')}
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-fg-2">{t('ana_no_lagging')}</p>
              )}
            </div>
          </>
        )}
      </section>
    </Card>
  );
}
