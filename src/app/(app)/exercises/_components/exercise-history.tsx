'use client';
import { useState } from 'react';
import type { Units } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepoQuery } from '@/hooks/use-repo';
import { formatDate, formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { parseLocalDay } from '@/lib/utils';
import { E1rmChart } from './e1rm-chart';
import { HistoryLogItem } from './history-log-item';
import { bestPoint, e1rmSeries } from './history-stats';
import { SectionCard } from './section-card';

const PAGE = 10;

interface ExerciseHistoryProps {
  exerciseId: string;
  profileId: string | undefined;
  units: Units;
  /** True while the active profile is still loading (show a skeleton, not "no history"). */
  profileLoading?: boolean;
}

/** This profile's logs containing the exercise (newest first), summary tiles and the e1RM chart. */
export function ExerciseHistory({ exerciseId, profileId, units, profileLoading = false }: ExerciseHistoryProps) {
  const { t, locale } = useT();
  const { data } = useRepoQuery(
    (repo) => (profileId ? repo.logs.historyFor(profileId, exerciseId) : Promise.resolve([])),
    [profileId, exerciseId],
  );
  const logs = profileLoading ? undefined : data;
  const [shown, setShown] = useState({ exerciseId, n: PAGE });
  const visible = shown.exerciseId === exerciseId ? shown.n : PAGE;

  const live = (logs ?? []).filter((l) => !l.deletedAt);
  const points = e1rmSeries(live, exerciseId);
  const best = bestPoint(points);

  return (
    <>
      <SectionCard title={t('ex_history')} id="ex-history" testId="exercise-history">
        {!logs ? (
          <Skeleton className="h-16 w-full" />
        ) : live.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ex_history_empty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-bg-2 p-3">
                <dt className="text-xs text-fg-muted">{t('ex_history_best')}</dt>
                <dd className="font-mono text-lg text-highlight" data-testid="exercise-best-e1rm">
                  {best ? formatWeight(best.e1rm, units, locale) : '–'}
                </dd>
                {best && (
                  <dd className="text-xs text-fg-muted">
                    {t('ex_history_best_on', { date: formatDate(parseLocalDay(best.date), locale) })}
                  </dd>
                )}
              </div>
              <div className="rounded-lg bg-bg-2 p-3">
                <dt className="sr-only">{t('ex_history')}</dt>
                <dd className="text-sm text-fg">{t('ex_history_sessions', { n: live.length })}</dd>
              </div>
            </dl>
            <ul className="flex flex-col gap-2">
              {live.slice(0, visible).map((log) => (
                <HistoryLogItem key={log.id} log={log} exerciseId={exerciseId} units={units} />
              ))}
            </ul>
            {live.length > visible && (
              <Button variant="secondary" size="sm" onClick={() => setShown({ exerciseId, n: visible + PAGE })}>
                {t('ex_history_more')}
              </Button>
            )}
          </div>
        )}
      </SectionCard>
      {logs && live.length > 0 && (
        <SectionCard title={t('ex_chart_e1rm')} id="ex-e1rm">
          <E1rmChart points={points} units={units} />
        </SectionCard>
      )}
    </>
  );
}
