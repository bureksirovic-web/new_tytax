'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Exercise, Units } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { SectionCard } from './section-card';

const GENDERS = ['male', 'female'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

interface Neighbours {
  id: string;
  easier?: Exercise;
  harder: Exercise[];
}

function useProgression(exercise: Exercise): Neighbours | undefined {
  const [state, setState] = useState<Neighbours>();
  const { id, progressionParentId, progressionChildIds } = exercise;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      progressionParentId ? catalog.getById(progressionParentId) : Promise.resolve(undefined),
      Promise.all((progressionChildIds ?? []).map((c) => catalog.getById(c))),
    ]).then(
      ([easier, harder]) => {
        if (!cancelled) setState({ id, easier, harder: harder.filter((h): h is Exercise => !!h) });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [id, progressionParentId, progressionChildIds]);
  return state?.id === id ? state : undefined;
}

const linkCls =
  'flex min-h-11 items-center rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Bodyweight progression neighbours and kettlebell recommended weights, when the exercise has them. */
export function ExerciseExtras({ exercise, units }: { exercise: Exercise; units: Units }) {
  const { t, locale } = useT();
  const prog = useProgression(exercise);
  const tiers = exercise.recommendedWeightKg;
  const hasProg = prog && (prog.easier || prog.harder.length > 0);

  return (
    <>
      {hasProg && (
        <SectionCard title={t('ex_progression')} id="ex-progression">
          <ul className="flex flex-wrap gap-2">
            {prog.easier && (
              <li>
                <Link className={linkCls} href={`/exercises/${encodeURIComponent(prog.easier.id)}`}>
                  {t('ex_progression_easier', { name: prog.easier.name })}
                </Link>
              </li>
            )}
            {prog.harder.map((h) => (
              <li key={h.id}>
                <Link className={linkCls} href={`/exercises/${encodeURIComponent(h.id)}`}>
                  {t('ex_progression_harder', { name: h.name })}
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {tiers && (
        <SectionCard title={t('ex_recommended_weight')} id="ex-kb-weight">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-fg-muted">
                <td />
                <th scope="col" className="py-1 text-right font-normal">{t('ex_level_beginner')}</th>
                <th scope="col" className="py-1 text-right font-normal">{t('ex_level_intermediate')}</th>
                <th scope="col" className="py-1 text-right font-normal">{t('ex_level_advanced')}</th>
              </tr>
            </thead>
            <tbody>
              {GENDERS.map((g) => (
                <tr key={g} className="border-t border-line">
                  <th scope="row" className="py-2 text-left font-normal text-fg-2">
                    {t(g === 'male' ? 'ex_gender_male' : 'ex_gender_female')}
                  </th>
                  {LEVELS.map((lvl) => (
                    <td key={lvl} className="py-2 text-right font-mono text-fg">
                      {formatWeight(tiers[g][lvl], units, locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </>
  );
}
