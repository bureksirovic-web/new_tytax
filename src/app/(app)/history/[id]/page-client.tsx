'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionExercise, SetEntry } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useLocale } from '@/components/providers';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatWeight } from '@/lib/utils';
import { countsAsWork, exerciseVolumeKg } from '@/stores/workout-selectors';

interface Props {
  params: Promise<{ id: string }>;
}

function SetLine({ set, index }: { set: SetEntry; index: number }) {
  const { t } = useLocale();
  const tone = countsAsWork(set) ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]';
  return (
    <li data-testid="history-set" className={`flex items-center gap-3 rounded px-2 py-1 text-xs ${tone}`}>
      <span className="w-6 text-center font-mono text-[var(--text-muted)]">{index}</span>
      <span className="font-medium">{formatWeight(set.kg)}</span>
      <span className="text-[var(--text-muted)]" aria-hidden="true">
        ×
      </span>
      <span className="font-medium">
        {set.reps} {t('workout_reps').toLowerCase()}
      </span>
      {set.type === 'warmup' && <span className="text-[var(--text-muted)]">{t('workout_warmup')}</span>}
      {set.isPR && <span className="font-bold text-[var(--highlight)]">{t('workout_pr')}</span>}
      {set.e1rm !== undefined && set.e1rm > 0 && (
        <span className="ml-auto font-mono text-[var(--text-muted)]">{Math.round(set.e1rm)}</span>
      )}
    </li>
  );
}

function ExerciseBlock({ ex }: { ex: SessionExercise }) {
  const { t } = useLocale();
  const doneSets = ex.sets.filter(countsAsWork).length;
  return (
    <section data-testid="history-exercise" className="mb-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
          {ex.exerciseName}
        </h2>
        <div className="shrink-0 text-right text-xs text-[var(--text-muted)]">
          <p>{formatWeight(exerciseVolumeKg(ex))}</p>
          <p>
            {doneSets} {t('sets').toLowerCase()}
          </p>
        </div>
      </div>
      <ol className="space-y-1">
        {ex.sets.map((set, i) => (
          <SetLine key={set.id} set={set} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold text-[var(--accent)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export default function HistoryDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const { profileId, loading: profileLoading } = useActiveProfile();
  const { data: log, loading } = useRepoQuery(
    (repo) => (profileId ? repo.logs.get(profileId, id) : Promise.resolve(undefined)),
    [profileId, id],
  );

  if (profileLoading || (loading && !log)) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <Skeleton className="h-10 w-48 rounded" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!log) {
    return (
      <p data-testid="history-not-found" className="p-4 pt-20 text-center text-[var(--text-muted)]">
        {t('workout_not_found')}
      </p>
    );
  }

  return (
    <div data-testid="history-detail" data-log-id={log.id} className="mx-auto max-w-2xl p-4 pb-24">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex min-h-11 items-center pt-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        {t('history')}
      </button>

      <section className="mb-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-[var(--text-primary)]">
          {log.sessionName}
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          <time dateTime={log.date}>{log.date}</time> · {formatDuration(log.durationSeconds)}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric value={formatWeight(Math.round(log.totalVolumeKg))} label={t('volume')} />
          <Metric value={String(log.totalSets)} label={t('sets')} />
          <Metric value={String(log.exercises.length)} label={t('exercise_plural')} />
        </div>
        {log.rpe !== undefined && (
          // i18n: `debrief_rpe` requested in docs/v2/requests/G1-i18n.md.
          <p data-testid="history-rpe" className="mt-2 text-xs text-[var(--text-muted)]">
            {t('debrief_title')}: {log.rpe}/10
          </p>
        )}
        {log.notes && (
          <p data-testid="history-notes" className="mt-2 rounded bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
            {log.notes}
          </p>
        )}
      </section>

      {log.exercises.map((ex) => (
        <ExerciseBlock key={ex.uid} ex={ex} />
      ))}
    </div>
  );
}
