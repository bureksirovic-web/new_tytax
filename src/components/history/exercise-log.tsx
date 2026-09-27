'use client';
import Link from 'next/link';
import type { SessionExercise, Units } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { rankableE1rm } from '@/lib/training';
import { StarIcon } from './icons';
import { formatClock, isTimeSet } from './duration';
import { countsAsWork, doneWorkingSets, exerciseHoldSeconds, exerciseVolumeKg, hasTimeSets, setRows } from './log-math';
import '@/lib/i18n/packs/history';

interface Props {
  ex: SessionExercise;
  units: Units;
  showUndone: boolean;
}

const cell = 'px-2 py-1.5';
const TONE_WORK = 'text-fg';
const TONE_REST = 'text-fg-muted';

/** One exercise of a finished log: Set | Load | Reps | RIR | e1RM; a time set shows mm:ss across Load+Reps. */
export function ExerciseLog({ ex, units, showUndone }: Props) {
  const { t, locale } = useT();
  const rows = setRows(ex, showUndone);
  const timed = hasTimeSets(ex);
  const onlyTimed = timed && ex.sets.every(isTimeSet);
  return (
    <section data-testid="history-exercise" className="mb-3 rounded-xl border border-line bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-fg">
          <Link
            href={`/exercises/${encodeURIComponent(ex.exerciseId)}`}
            className="inline-flex min-h-11 items-center rounded hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
          >
            {ex.exerciseName}
          </Link>
        </h3>
        <div className="shrink-0 text-right text-xs text-fg-muted">
          {onlyTimed ? null : (
            <p data-testid="history-exercise-volume">{formatWeight(exerciseVolumeKg(ex), units, locale)}</p>
          )}
          {timed ? (
            <p data-testid="history-exercise-hold">
              {t('hist_hold_value', { time: formatClock(exerciseHoldSeconds(ex)) })}
            </p>
          ) : null}
          <p>{t('hist_sets_count', { n: doneWorkingSets(ex) })}</p>
        </div>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-fg-muted">
          <tr>
            <th scope="col" className={cell}>{t('hist_col_set')}</th>
            {onlyTimed ? (
              <th scope="col" colSpan={2} className={cell}>{t('hist_col_time')}</th>
            ) : (
              <>
                <th scope="col" className={cell}>{t('hist_col_load')}</th>
                <th scope="col" className={cell}>{t('hist_col_reps')}</th>
              </>
            )}
            <th scope="col" className={cell}>{t('hist_col_rir')}</th>
            <th scope="col" className={`${cell} text-right`}>{t('hist_col_e1rm')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ set, number }) => {
            const work = countsAsWork(set);
            const tone = work ? TONE_WORK : TONE_REST;
            const timeSet = isTimeSet(set);
            // Only rankable sets (≤ E1RM_MAX_REPS reps, G4-41) show an e1RM; a stored value never overrides the cap.
            const rankable = work && !timeSet ? rankableE1rm(set) : undefined;
            const e1rm = rankable === undefined ? 0 : (set.e1rm ?? rankable);
            return (
              <tr
                key={set.id}
                data-testid="history-set"
                data-set-type={set.type}
                data-done={set.done ? 'true' : 'false'}
                className={`border-t border-line ${tone}`}
              >
                <th scope="row" className={`${cell} font-mono font-normal`}>
                  {number === null ? (
                    <abbr title={t('hist_warmup_set')} className="font-semibold text-highlight no-underline">
                      {t('hist_warmup_tag')}
                    </abbr>
                  ) : (
                    number
                  )}
                  {!set.done ? <span className="ml-1 italic">({t('hist_undone_tag')})</span> : null}
                </th>
                {timeSet ? (
                  <td colSpan={2} data-testid="history-set-duration" className={`${cell} font-mono`}>
                    {onlyTimed ? null : <span className="sr-only">{t('hist_col_time')}: </span>}
                    {formatClock(set.durationSeconds ?? 0)}
                  </td>
                ) : (
                  <>
                    <td className={`${cell} font-mono`}>{formatWeight(set.kg, units, locale)}</td>
                    <td className={`${cell} font-mono`}>{set.reps}</td>
                  </>
                )}
                <td className={`${cell} font-mono`}>{set.rir != null ? `@${set.rir}` : t('hist_none')}</td>
                <td className={`${cell} text-right font-mono`}>
                  <span className="inline-flex items-center gap-1">
                    {set.isPR ? (
                      <span className="text-highlight" role="img" aria-label={t('hist_pr_set')}>
                        <StarIcon />
                      </span>
                    ) : null}
                    {e1rm > 0 ? formatWeight(e1rm, units, locale) : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ex.notes ? <p className="mt-2 text-xs text-fg-2">{t('hist_exercise_notes', { notes: ex.notes })}</p> : null}
    </section>
  );
}
