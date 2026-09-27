'use client';
import type { MuscleImpact } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import { IMPACT_LEVEL_KEYS, impactLevel, impactMuscleKey, labelOr } from './labels';
import { SectionCard } from './section-card';
import '@/lib/i18n/packs/exercises';

const BAR_FILL: Record<string, string> = {
  primary: 'fill-accent',
  secondary: 'fill-highlight',
  tertiary: 'fill-fg-muted',
};

/** Muscle impact as a bar list sorted by score; each row reads as text for screen readers. */
export function ImpactList({ impact }: { impact: readonly MuscleImpact[] }) {
  const { t } = useT();
  const rows = [...impact].sort((a, b) => b.score - a.score);
  if (rows.length === 0) return null;

  return (
    <SectionCard title={t('ex_impact')} id="ex-impact" testId="exercise-impact">
      <ul className="flex flex-col gap-3">
        {rows.map((m, i) => {
          const level = impactLevel(m.score);
          const muscle = labelOr(t, impactMuscleKey(m.muscle), m.muscle);
          const score = Math.max(0, Math.min(100, Math.round(m.score)));
          return (
            <li key={`${m.muscle}-${i}`} className="flex flex-col gap-1">
              <span className="sr-only">{t('ex_impact_row', { muscle, score, level: t(IMPACT_LEVEL_KEYS[level]) })}</span>
              <span aria-hidden="true" className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-fg-2">{muscle}</span>
                <span className="text-fg-muted">
                  {t(IMPACT_LEVEL_KEYS[level])} · <span className="font-mono tabular-nums text-fg">{score}</span>
                </span>
              </span>
              <svg aria-hidden="true" className="h-2 w-full" viewBox="0 0 100 2" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="2" rx="1" className="fill-bg-2" />
                <rect x="0" y="0" width={score} height="2" rx="1" className={BAR_FILL[level]} />
              </svg>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
