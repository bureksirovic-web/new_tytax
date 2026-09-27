'use client';
import Link from 'next/link';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { formatDate, formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { durationMinutes } from '@/components/history/log-math';
import { doneWorkingVolume, pluralCategory } from './dashboard-math';
import { cardSection, eyebrow } from './styles';
import '@/lib/i18n/packs/dashboard';

export interface LastWorkoutCardProps {
  log: WorkoutLog;
  units: Units;
}

/** Newest non-deleted workout of the active profile; the whole card links to its history detail. */
export function LastWorkoutCard({ log, units }: LastWorkoutCardProps) {
  const { t, locale } = useT();
  const sets = log.totalSets;
  // Same rounding as /history (floor, minimum 1) so both screens agree on one workout.
  const minutes = durationMinutes(log.durationSeconds);
  // `date` is a local calendar day; format the start timestamp instead of parsing it as UTC midnight.
  const when = formatDate(log.startedAt, locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <section aria-labelledby="dash-last-heading" data-testid="dash-last-workout" className={cardSection}>
      <h2 id="dash-last-heading" className={`${eyebrow} mb-2`}>
        {t('dash_last_workout')}
      </h2>
      <Link
        href={`/history/${log.id}`}
        aria-label={t('dash_open_workout', { name: log.sessionName })}
        aria-describedby="dash-last-when dash-last-stats"
        className="-m-2 block min-h-11 rounded-lg p-2 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-lg font-bold uppercase tracking-wide text-fg">{log.sessionName}</span>
          <span id="dash-last-when" className="shrink-0 text-xs text-fg-muted">{when}</span>
        </span>
        <span id="dash-last-stats" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-2">
          <span>{t(`dash_sets_${pluralCategory(sets, locale)}`, { count: sets })}</span>
          <span className="font-mono">{formatWeight(doneWorkingVolume(log), units, locale)}</span>
          <span>{t('dash_duration_min', { min: minutes })}</span>
          {log.prCount > 0 && (
            <span className="font-semibold text-highlight">
              {t(`dash_prs_${pluralCategory(log.prCount, locale)}`, { count: log.prCount })}
            </span>
          )}
        </span>
      </Link>
    </section>
  );
}
