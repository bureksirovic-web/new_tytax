'use client';
import Link from 'next/link';
import type { SetEntry, Units, WorkoutLog } from '@/contracts/domain';
import { formatDate, formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { parseLocalDay } from '@/lib/utils';
import { formatDuration } from './format-duration';
import { bestE1rm, doneWorkingSets, isTimedSet, longestHold } from './history-stats';

interface HistoryLogItemProps {
  log: WorkoutLog;
  exerciseId: string;
  units: Units;
  /** The exercise is time-measured: sets show durations and the session's longest hold, no e1RM. */
  timed?: boolean;
}

/** One past session: date, name, done working sets (kg×reps @RIR, or durations) and its best. */
export function HistoryLogItem({ log, exerciseId, units, timed = false }: HistoryLogItemProps) {
  const { t, locale } = useT();
  const sets = doneWorkingSets(log, exerciseId);
  const best = timed ? 0 : bestE1rm(sets);
  const hold = timed ? longestHold(sets) : 0;
  const date = formatDate(parseLocalDay(log.date), locale);
  const w = (kg: number) => formatWeight(kg, units, locale);
  const setText = (s: SetEntry): string => {
    if (isTimedSet(s)) {
      const d = formatDuration(t, s.durationSeconds!);
      return s.kg > 0 ? t('ex_set_weighted_hold', { weight: w(s.kg), duration: d }) : d;
    }
    const rir = s.rir !== undefined && s.rir !== null ? ` ${t('ex_set_rir', { rir: s.rir })}` : '';
    return `${w(s.kg)}×${s.reps}${rir}`;
  };

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
              {t('ex_history_session_best', { value: w(best) })}
            </span>
          )}
          {hold > 0 && (
            <span className="flex-shrink-0 font-mono text-xs text-highlight">
              {t('ex_history_session_hold', { value: formatDuration(t, hold) })}
            </span>
          )}
        </span>
        {sets.length === 0 ? (
          <span className="text-xs text-fg-muted">{t('ex_history_no_working_sets')}</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-fg-2">
            {sets.map((s) => (
              <span key={s.id}>{setText(s)}</span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}
