'use client';
import Link from 'next/link';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { formatDate, formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { parseLocalDay } from '@/lib/utils';
import { bestE1rm, doneWorkingSets } from './history-stats';

interface HistoryLogItemProps {
  log: WorkoutLog;
  exerciseId: string;
  units: Units;
}

/** One past session: date, name, done working sets (kg×reps @RIR) and its best e1RM. */
export function HistoryLogItem({ log, exerciseId, units }: HistoryLogItemProps) {
  const { t, locale } = useT();
  const sets = doneWorkingSets(log, exerciseId);
  const best = bestE1rm(sets);
  const date = formatDate(parseLocalDay(log.date), locale);

  return (
    <li>
      <Link
        href={`/history/${encodeURIComponent(log.id)}`}
        data-testid={`exercise-history-${log.id}`}
        className="flex min-h-11 flex-col gap-1 rounded-lg border border-line bg-bg-2 px-3 py-2 transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-fg">
            {date} · {log.sessionName}
          </span>
          {best > 0 && (
            <span className="flex-shrink-0 font-mono text-xs text-highlight">
              {t('ex_history_session_best', { value: formatWeight(best, units, locale) })}
            </span>
          )}
        </span>
        {sets.length === 0 ? (
          <span className="text-xs text-fg-muted">{t('ex_history_no_working_sets')}</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-fg-2">
            {sets.map((s) => (
              <span key={s.id}>
                {formatWeight(s.kg, units, locale)}×{s.reps}
                {s.rir !== undefined && s.rir !== null ? ` ${t('ex_set_rir', { rir: s.rir })}` : ''}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}
