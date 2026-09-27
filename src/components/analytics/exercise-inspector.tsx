'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { Card, CardHeader } from '@/components/ui';
import { SectionTitle } from './section-title';
import { useT } from '@/lib/i18n/use-t';
import { ExerciseProgress } from './exercise-progress';
import type { TrainedExercise } from './exercise-series';

interface Props {
  logs: readonly WorkoutLog[];
  exercises: readonly TrainedExercise[];
  units: Units;
  /** True when the catalog has the exercise (custom ones have no /exercises page). */
  inCatalog: (id: string) => boolean;
}

const LINK =
  'inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-highlight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Picker over exercises with history + that exercise's progress. */
export function ExerciseInspector({ logs, exercises, units, inCatalog }: Props) {
  const { t } = useT();
  const selectId = useId();
  const [picked, setPicked] = useState<string>('');
  const current = exercises.some((e) => e.id === picked) ? picked : (exercises[0]?.id ?? '');

  return (
    <Card>
      <section aria-labelledby="ana-inspector-title">
        <CardHeader>
          <SectionTitle id="ana-inspector-title">{t('ana_inspector')}</SectionTitle>
        </CardHeader>
        {exercises.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_no_data')}</p>
        ) : (
          <>
            <label htmlFor={selectId} className="mb-1 block font-display text-xs uppercase tracking-wider text-fg-muted">
              {t('ana_pick_exercise')}
            </label>
            <select
              id={selectId}
              value={current}
              onChange={(e) => setPicked(e.target.value)}
              className="mb-4 min-h-11 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
            >
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <ExerciseProgress logs={logs} exerciseId={current} units={units} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/analytics/${encodeURIComponent(current)}`} className={LINK}>
                {t('ana_open_details')}
              </Link>
              {inCatalog(current) && (
                <Link href={`/exercises/${encodeURIComponent(current)}`} className={LINK}>
                  {t('ana_view_exercise')}
                </Link>
              )}
            </div>
          </>
        )}
      </section>
    </Card>
  );
}
