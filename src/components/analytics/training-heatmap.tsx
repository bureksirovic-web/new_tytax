'use client';
import { useMemo } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { Card, CardHeader } from '@/components/ui';
import { formatDate, formatWeight } from '@/lib/i18n';
import { SectionTitle } from './section-title';
import { useT } from '@/lib/i18n/use-t';
import { heatLevel, heatmapWeeks } from './analytics-math';
import { dayLabel } from './labels';
import '@/lib/i18n/packs/analytics';

interface Props {
  logs: readonly WorkoutLog[];
  now: Date;
  units: Units;
  weeks?: number;
}

const LEVEL_CLASS = ['bg-bg-2', 'bg-od-green-800', 'bg-od-green-700', 'bg-od-green-600', 'bg-od-green-400'] as const;

/** Calendar of training days, Monday-first weeks as columns, with a text alternative per day. */
export function TrainingHeatmap({ logs, now, units, weeks = 12 }: Props) {
  const { t, locale } = useT();
  const grid = useMemo(() => heatmapWeeks(logs, now, weeks), [logs, now, weeks]);
  const days = grid.flat();
  const past = days.filter((d) => !d.future);
  const trained = past.filter((d) => d.sessions > 0).length;
  const maxVolume = Math.max(0, ...days.map((d) => d.volumeKg));
  // 2024-01-01 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 1 + i), locale, { weekday: 'short' }));

  return (
    <Card>
      <section aria-labelledby="ana-heatmap-title">
        <CardHeader>
          <SectionTitle id="ana-heatmap-title">{t('ana_heatmap')}</SectionTitle>
        </CardHeader>
        <p className="mb-3 text-sm text-fg-2" data-testid="ana-heatmap-summary">
          {t('ana_heatmap_summary', { days: trained, total: past.length, weeks })}
        </p>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <caption className="sr-only">{t('ana_heatmap')}</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">{t('ana_col_weekday')}</th>
                {grid.map((week) => (
                  <th key={week[0].day} scope="col" className="sr-only">{dayLabel(week[0].day, locale)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekdays.map((name, row) => (
                <tr key={name}>
                  <th scope="row" className="pr-1 text-right text-[10px] font-normal text-fg-muted">{name}</th>
                  {grid.map((week) => {
                    const d = week[row];
                    const label = d.future
                      ? t('ana_heatmap_future', { date: dayLabel(d.day, locale) })
                      : d.sessions === 0
                        ? t('ana_heatmap_rest', { date: dayLabel(d.day, locale) })
                        : t('ana_heatmap_trained', { date: dayLabel(d.day, locale), count: d.sessions, volume: formatWeight(d.volumeKg, units, locale) });
                    const level = heatLevel(d.volumeKg, d.sessions, maxVolume);
                    return (
                      <td key={d.day} className="p-0" data-day={d.day} data-level={d.future ? 'future' : level}>
                        <span
                          title={label}
                          className={`block h-4 w-4 rounded-sm ${d.future ? 'border border-dashed border-line' : LEVEL_CLASS[level]}`}
                        >
                          <span className="sr-only">{label}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-fg-muted" aria-hidden="true">
          <span>{t('ana_heatmap_less')}</span>
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={`block h-3 w-3 rounded-sm ${cls}`} />
          ))}
          <span>{t('ana_heatmap_more')}</span>
        </div>
      </section>
    </Card>
  );
}
