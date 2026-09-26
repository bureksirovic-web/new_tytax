'use client';
import Link from 'next/link';
import type { WorkoutLog } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useLocale } from '@/components/providers';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatWeight } from '@/lib/utils';

function exerciseNames(log: WorkoutLog): string {
  return [...new Set(log.exercises.map((e) => e.exerciseName))].join(', ');
}

function HistoryItem({ log }: { log: WorkoutLog }) {
  const { t } = useLocale();
  return (
    <li>
      <Link
        href={`/history/${log.id}`}
        data-testid="history-item"
        data-log-id={log.id}
        className="block min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 hover:bg-[var(--bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
              {log.sessionName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              <time dateTime={log.date}>{log.date}</time>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-[var(--accent)]">{formatWeight(Math.round(log.totalVolumeKg))}</p>
            <p className="text-xs text-[var(--text-muted)]">
              <span data-testid="history-item-sets">{log.totalSets}</span> {t('sets').toLowerCase()}
            </p>
          </div>
        </div>
        {log.exercises.length > 0 && (
          <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">{exerciseNames(log)}</p>
        )}
      </Link>
    </li>
  );
}

export default function HistoryPage() {
  const { t } = useLocale();
  const { profileId, loading: profileLoading } = useActiveProfile();
  const { data: logs, loading, error } = useRepoQuery(
    (repo) => (profileId ? repo.logs.list(profileId) : Promise.resolve([])),
    [profileId],
  );
  const list = logs ?? [];
  const busy = profileLoading || (loading && !logs);

  return (
    <div data-testid="history-list" className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center justify-between pt-2">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {t('history')}
        </h1>
        {!busy && (
          <span className="text-sm text-[var(--text-muted)]">
            {list.length} {list.length === 1 ? t('history_session') : t('history_sessions')}
          </span>
        )}
      </header>

      {error ? (
        <p role="alert" className="py-8 text-center text-sm text-[var(--text-muted)]">
          {t('error')}
        </p>
      ) : busy ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div data-testid="history-empty">
          <EmptyState icon="◈" title={t('no_workouts_yet')} description={t('no_workouts_desc')} />
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((log) => (
            <HistoryItem key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}
