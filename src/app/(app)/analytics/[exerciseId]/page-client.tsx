'use client';
import Link from 'next/link';
import { use } from 'react';
import { useExerciseAnalytics } from '@/hooks/use-analytics';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers';
import { formatWeight } from '@/lib/utils';
import type { E1RMDataPointWithExercise } from '@/lib/analytics/pr-tracker';

interface Props {
  params: Promise<{ exerciseId: string }>;
}

function E1RMChart({ points }: { points: E1RMDataPointWithExercise[] }) {
  const { t } = useLocale();
  if (points.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('no_data_display')}
      </p>
    );
  }
  const maxE1rm = Math.max(...points.map((p) => p.e1rm), 1);
  const minE1rm = Math.min(...points.map((p) => p.e1rm));
  const range = maxE1rm - minE1rm || 1;
  const best = points.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), points[0]);

  return (
    <div>
      <div className="relative h-32 flex items-end gap-0.5">
        {points.map((pt) => {
          const pct = ((pt.e1rm - minE1rm) / range) * 100;
          const isBest = pt.date === best.date && pt.e1rm === best.e1rm;
          return (
            <div
              key={pt.date}
              className="flex-1 rounded-t relative group"
              style={{
                height: `${Math.max(pct, 4)}%`,
                backgroundColor: isBest ? 'var(--highlight)' : 'var(--accent)',
                opacity: isBest ? 1 : 0.65,
              }}
              title={`${pt.date}: ${Math.round(pt.e1rm)} kg e1RM (${formatWeight(pt.weight)} × ${pt.reps})`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {points[0].date}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {points.at(-1)!.date}
        </span>
      </div>
    </div>
  );
}

export default function ExerciseAnalyticsPage({ params }: Props) {
  const { exerciseId } = use(params);
  const decoded = decodeURIComponent(exerciseId);
  const { t } = useLocale();
  const { e1rmProgression, isLoading } = useExerciseAnalytics(decoded);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-48 rounded" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const best = e1rmProgression.reduce<E1RMDataPointWithExercise | null>(
    (a, b) => (!a || b.e1rm > a.e1rm ? b : a),
    null
  );

  const volHistory = e1rmProgression.map((pt) => ({
    date: pt.date,
    volume: pt.weight * pt.reps,
  }));
  const maxVol = Math.max(...volHistory.map((v) => v.volume), 1);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/analytics"
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          &larr; {t('analytics')}
        </Link>
      </div>

      <h1
        className="text-xl font-bold uppercase tracking-wider"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {decoded}
      </h1>

      {best && (
        <Card>
          <CardHeader>
            <CardTitle>{t('personal_best')}</CardTitle>
          </CardHeader>
          <div className="flex gap-6">
            <div>
              <div
                className="text-4xl font-bold"
                style={{ color: 'var(--highlight)', fontFamily: 'var(--font-display)' }}
              >
                {Math.round(best.e1rm)} kg
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                e1RM
              </div>
            </div>
            <div className="text-sm space-y-1 pt-1" style={{ color: 'var(--text-secondary)' }}>
              <div>{formatWeight(best.weight)} × {best.reps} {t('workout_reps').toLowerCase()}</div>
              <div style={{ color: 'var(--text-muted)' }}>{best.date}</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('e1rm_progression')}</CardTitle>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {e1rmProgression.length} {t('history_sessions').toLowerCase()}
          </span>
        </CardHeader>
        <E1RMChart points={e1rmProgression} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('volume_per_session')}</CardTitle>
        </CardHeader>
        {volHistory.length > 0 ? (
          <>
            <div className="flex items-end gap-0.5 h-20">
              {volHistory.map((v) => (
                <div
                  key={v.date}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(v.volume / maxVol) * 100}%`,
                    backgroundColor: 'var(--accent)',
                    opacity: 0.7,
                  }}
                  title={`${v.date}: ${Math.round(v.volume)} kg`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {volHistory[0].date}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {volHistory.at(-1)!.date}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('no_sessions_found')}</p>
        )}
      </Card>
    </div>
  );
}
