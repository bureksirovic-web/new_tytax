'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { DetailMetrics } from './detail-metrics';
import { ExerciseLog } from './exercise-log';
import { PencilIcon, TrashIcon } from './icons';
import { durationMinutes, formatLogDate, formatStartTime, splitExercises } from './log-math';
import { logDisplayName } from './log-name';
import { MuscleImpact } from './muscle-impact';
import { useHistoryUndo } from './undo-store';

interface Props {
  log: WorkoutLog;
  units: Units;
  programName?: string;
}

const actionCls =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';
const toggleCls =
  'min-h-11 rounded-lg px-3 text-xs font-medium text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';

export function HistoryDetail({ log, units, programName }: Props) {
  const { t, locale } = useT();
  const repo = useRepo();
  const router = useRouter();
  const remove = useHistoryUndo((s) => s.remove);
  const [expanded, setExpanded] = useState(true);
  const [showUndone, setShowUndone] = useState(false);
  const [failed, setFailed] = useState(false);
  const { shown, skipped } = splitExercises(log);
  const name = logDisplayName(log, t);
  const fullDate = formatLogDate(log, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const minutes = durationMinutes(log.durationSeconds);

  const onDelete = async () => {
    setFailed(false);
    try {
      await remove(repo, log.profileId, log.id);
      router.replace('/history');
    } catch {
      setFailed(true);
    }
  };

  return (
    <article data-testid="history-detail" data-log-id={log.id} className="mx-auto max-w-2xl p-4 pb-24">
      <Link href="/history" className="mb-2 inline-flex min-h-11 items-center text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
        {t('hist_back')}
      </Link>
      <header className="mb-4 rounded-xl border border-line bg-card p-4">
        <h1 data-testid="page-heading-history-detail" className="font-display text-xl font-bold uppercase tracking-wider text-fg">
          {name}
        </h1>
        <p className="mt-1 text-xs text-fg-muted">
          <time dateTime={log.startedAt}>{fullDate}</time>
          <span aria-hidden="true"> · </span>
          {t('hist_started_at', { time: formatStartTime(log.startedAt, locale) })}
        </p>
        {programName && log.programId ? (
          <p className="mt-1 text-xs">
            <Link href={`/programs/${log.programId}`} className="inline-flex min-h-11 items-center text-fg-2 underline hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
              {t('hist_program', { name: programName })}
            </Link>
          </p>
        ) : null}
        {log.isDeload ? <p className="mt-1 text-xs font-semibold text-fg-2">{t('hist_deload')}</p> : null}
        <p className="sr-only">
          {t('hist_summary', { date: fullDate, sets: log.totalSets, volume: formatWeight(log.totalVolumeKg, units, locale), minutes })}
        </p>
        <DetailMetrics log={log} units={units} />
        {log.notes ? (
          <section aria-label={t('hist_notes')} className="mt-3">
            <h2 className="font-display text-xs uppercase tracking-wider text-fg-muted">{t('hist_notes')}</h2>
            <p data-testid="history-notes" className="mt-1 whitespace-pre-wrap rounded border-l-2 border-highlight bg-bg-2 p-2 text-sm text-fg-2">
              {log.notes}
            </p>
          </section>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/history/${log.id}/edit`} data-testid="history-edit" className={`${actionCls} text-fg hover:bg-card-hover`}>
            <PencilIcon />
            {t('hist_edit')}
          </Link>
          <button type="button" data-testid="history-delete" onClick={onDelete} className={`${actionCls} text-fg-2 hover:bg-card-hover hover:text-fg`}>
            <TrashIcon />
            {t('hist_delete')}
          </button>
        </div>
        {failed ? (
          <p role="alert" className="mt-2 text-sm text-fg-2">
            {t('hist_action_failed')}
          </p>
        ) : null}
      </header>
      <MuscleImpact log={log} />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-expanded={expanded} aria-controls="history-session-log" onClick={() => setExpanded((v) => !v)} className={toggleCls}>
          {expanded ? t('hist_collapse') : t('hist_view_log')}
        </button>
        {expanded ? (
          <button type="button" aria-pressed={showUndone} onClick={() => setShowUndone((v) => !v)} className={toggleCls}>
            {showUndone ? t('hist_hide_undone') : t('hist_show_undone')}
          </button>
        ) : null}
      </div>
      <div id="history-session-log" hidden={!expanded}>
        <h2 className="sr-only">{t('hist_exercises')}</h2>
        <p className="mb-2 text-xs text-fg-muted">{t('hist_warmup_legend')}</p>
        {shown.map((ex) => (
          <ExerciseLog key={ex.uid} ex={ex} units={units} showUndone={showUndone} />
        ))}
        {skipped > 0 ? (
          <p data-testid="history-skipped" className="text-xs text-fg-muted">
            {t('hist_skipped_hidden', { n: skipped })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
