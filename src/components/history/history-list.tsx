'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { WorkoutLog } from '@/contracts/domain';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { parseLocalDay } from '@/lib/utils';
import { DamagedCard, isRenderableLog } from './damaged-log';
import { HistoryCard } from './history-card';
import { groupByMonth } from './log-math';
import { useHistoryUndo } from './undo-store';

export const HISTORY_PAGE_SIZE = 20;
const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

interface Page {
  /** Profile the page was read for: a page of another profile is never shown. */
  profileId: string | undefined;
  logs: WorkoutLog[];
  total: number;
}

/** The active profile's finished logs, newest first, grouped by month, with "Load more". */
export function HistoryList() {
  const { t, locale } = useT();
  const repo = useRepo();
  const remove = useHistoryUndo((s) => s.remove);
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const [failed, setFailed] = useState(false);
  const { data, error } = useRepoQuery<Page>(
    async (r) => {
      if (!profileId) return { profileId, logs: [], total: 0 };
      const [logs, total] = await Promise.all([r.logs.list(profileId, { limit }), r.logs.count(profileId)]);
      // A row the list can never return (e.g. a restored row without a date) must
      // not inflate the count: once a page comes back short, the list is complete.
      return { profileId, logs, total: logs.length < limit ? logs.length : Math.max(total, logs.length) };
    },
    [profileId, limit],
  );
  // Keep showing the previous page while the next one loads (no skeleton flash),
  // but only for the same profile: after a profile switch the old list must go.
  const [shown, setShown] = useState<Page | undefined>(undefined);
  if (data && data !== shown) setShown(data);
  const page = data ?? (shown && shown.profileId === profileId ? shown : undefined);
  const units = profile?.settings.units ?? 'kg';

  const onDelete = async (log: WorkoutLog) => {
    setFailed(false);
    try {
      await remove(repo, log.profileId, log.id);
    } catch {
      setFailed(true);
    }
  };

  if (error) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-fg-muted">
        {t('hist_error')}
      </p>
    );
  }
  const listed = page?.logs.filter((l) => typeof l.date === 'string' && /^\d{4}-\d{2}/.test(l.date)) ?? [];
  const undated = page?.logs.filter((l) => !listed.includes(l)) ?? [];
  if (profileLoading || !page) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="sr-only" role="status">{t('hist_loading')}</p>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (page.total === 0) {
    return (
      <div data-testid="history-empty" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <h2 className="font-display text-base font-semibold text-fg-2">{t('hist_empty_title')}</h2>
        <p className="text-sm text-fg-muted">{t('hist_empty_desc')}</p>
        <Link
          href="/workout"
          className="flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-medium text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
        >
          {t('hist_empty_cta')}
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="history-list">
      <p data-testid="history-count" className="mb-3 text-sm text-fg-muted">
        {t('hist_sessions_count', { n: page.total })}
      </p>
      {failed ? (
        <p role="alert" className="mb-3 text-sm text-fg-2">
          {t('hist_action_failed')}
        </p>
      ) : null}
      {groupByMonth(listed).map((group) => (
        <section key={group.key} aria-labelledby={`hist-month-${group.key}`} className="mb-5">
          <h2
            id={`hist-month-${group.key}`}
            className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-fg-muted"
          >
            {formatDate(parseLocalDay(`${group.key}-01`), locale, MONTH_FORMAT)}
          </h2>
          <ul className="space-y-3">
            {group.logs.map((log) =>
              isRenderableLog(log) ? (
                <HistoryCard key={log.id} log={log} units={units} onDelete={onDelete} />
              ) : (
                <DamagedCard key={log.id} log={log} onDelete={onDelete} />
              ),
            )}
          </ul>
        </section>
      ))}
      {undated.length > 0 ? (
        <ul className="mb-5 space-y-3">
          {undated.map((log) => (
            <DamagedCard key={log.id} log={log} onDelete={onDelete} />
          ))}
        </ul>
      ) : null}
      {page.logs.length < page.total ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-fg-muted">{t('hist_showing', { shown: page.logs.length, total: page.total })}</p>
          <Button variant="secondary" onClick={() => setLimit((n) => n + HISTORY_PAGE_SIZE)} data-testid="history-load-more">
            {t('hist_load_more')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
