'use client';
import Link from 'next/link';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { PencilIcon, TrashIcon } from './icons';
import { durationMinutes, formatLogDate } from './log-math';
import { logDisplayName } from './log-name';

interface Props {
  log: WorkoutLog;
  units: Units;
  onDelete: (log: WorkoutLog) => void;
}

const iconBtn =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';

export function HistoryCard({ log, units, onDelete }: Props) {
  const { t, locale } = useT();
  const name = logDisplayName(log, t);
  const date = formatLogDate(log, locale);
  const named = { name, date };

  return (
    <li
      data-testid="history-item"
      data-log-id={log.id}
      className="flex items-stretch gap-1 rounded-xl border border-line bg-card"
    >
      <Link
        href={`/history/${log.id}`}
        className="block min-h-[72px] min-w-0 flex-1 rounded-xl p-4 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-fg">{name}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              <time dateTime={log.date}>{date}</time>
              <span aria-hidden="true"> · </span>
              <span>{t('hist_minutes', { n: durationMinutes(log.durationSeconds) })}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p data-testid="history-item-volume" className="font-mono text-sm font-bold text-accent-fg">
              {formatWeight(log.totalVolumeKg, units, locale)}
            </p>
            <p data-testid="history-item-sets" className="text-xs text-fg-muted">
              {t('hist_sets_count', { n: log.totalSets })}
            </p>
          </div>
        </div>
        {log.prCount > 0 || log.isDeload ? (
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            {log.prCount > 0 ? (
              <span data-testid="history-item-prs" className="rounded border border-line px-2 py-0.5 font-semibold text-highlight">
                {t('hist_prs', { n: log.prCount })}
              </span>
            ) : null}
            {log.isDeload ? (
              <span className="rounded border border-line px-2 py-0.5 text-fg-2">{t('hist_deload')}</span>
            ) : null}
          </p>
        ) : null}
      </Link>
      <div className="flex flex-col justify-center gap-1 py-1 pr-1">
        <Link href={`/history/${log.id}/edit`} aria-label={t('hist_edit_named', named)} className={iconBtn}>
          <PencilIcon />
        </Link>
        <button
          type="button"
          data-testid="history-item-delete"
          aria-label={t('hist_delete_named', named)}
          onClick={() => onDelete(log)}
          className={iconBtn}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}
