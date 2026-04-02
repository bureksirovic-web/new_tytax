'use client';
import Link from 'next/link';
import { useHistory } from '@/hooks/use-history';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDuration, formatWeight } from '@/lib/utils';
import { useLocale } from '@/components/providers';
import type { WorkoutLog } from '@/types/workout';

type ModalityBadge = 'tytax' | 'bodyweight' | 'kettlebell' | 'custom' | 'default';

function modalityVariant(mod: string): ModalityBadge {
  if (mod === 'tytax') return 'tytax';
  if (mod === 'bodyweight') return 'bodyweight';
  if (mod === 'kettlebell') return 'kettlebell';
  return 'default';
}

function WorkoutCard({ log }: { log: WorkoutLog }) {
  const { t } = useLocale();
  const exerciseCount = log.exercises.length;
  const uniqueModalities = [...new Set(log.modalitiesUsed ?? [])];

  return (
    <Link href={`/history/${log.id}`}>
      <Card
        hoverable
        className="mb-3"
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="font-semibold text-sm uppercase tracking-wide"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {log.sessionName}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {log.date} &mdash; {formatDuration(log.durationSeconds)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              {formatWeight(log.totalVolumeKg)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {exerciseCount} {t('exercise_plural')} &bull; {log.totalSets} {t('sets').toLowerCase()}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {uniqueModalities.map((mod) => (
            <Badge key={mod} variant={modalityVariant(mod)}>
              {mod}
            </Badge>
          ))}
          {log.prCount > 0 && (
            <Badge variant="warning">{log.prCount} PR{log.prCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function HistoryPage() {
  const { t } = useLocale();
  const { logs, total, page, hasMore, nextPage, prevPage, isLoading } = useHistory(20);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between pt-2 mb-4">
        <h1
          className="text-2xl font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {t('history')}
        </h1>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {total} {total !== 1 ? t('history_sessions') : t('history_session')}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon="dumbbell"
          title={t('no_workouts_yet')}
          description={t('no_workouts_desc')}
        />
      ) : (
        <>
          {logs.map((log) => (
            <WorkoutCard key={log.id} log={log} />
          ))}

          <div className="flex items-center justify-between mt-4 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevPage}
              disabled={page === 0}
            >
              &larr; {t('prev')}
            </Button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('page')} {page + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextPage}
              disabled={!hasMore}
            >
              {t('next_page')} &rarr;
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
