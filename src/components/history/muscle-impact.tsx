'use client';
import { useMemo } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import { useCatalog } from '@/hooks/use-exercises';
import { useT } from '@/lib/i18n/use-t';
import { training } from '@/lib/training';
import { muscleLabel } from '@/components/analytics/labels';
import '@/lib/i18n/packs/history';

const TOP_N = 6;

export interface MuscleShare {
  muscle: string;
  share: number;
}

/** Shares sorted high → low (ties by name), for one log. */
export function logMuscleShares(log: WorkoutLog, lookup: Parameters<typeof training.impactDistribution>[1]): MuscleShare[] {
  const dist = training.impactDistribution([log], lookup);
  return Object.entries(dist)
    .map(([muscle, share]) => ({ muscle, share }))
    .sort((a, b) => b.share - a.share || a.muscle.localeCompare(b.muscle));
}

/**
 * Where this workout's stimulus went (done working sets × catalog impact).
 * While the catalog loads or when it fails, each exercise's stored
 * `muscleImpactSnapshot` is used instead, so the card still shows offline.
 */
export function MuscleImpact({ log }: { log: WorkoutLog }) {
  const { t, locale } = useT();
  const { catalog, loading } = useCatalog();
  const shares = useMemo(
    () => logMuscleShares(log, (id) => catalog?.getById(id)),
    [catalog, log],
  );
  // No snapshot to show yet: wait for the catalog rather than flash "none".
  if (shares.length === 0 && loading) return null;
  const top = shares[0]?.share ?? 1;
  const pct = (share: number) => new Intl.NumberFormat(locale === 'hr' ? 'hr-HR' : 'en-GB', { maximumFractionDigits: 0 }).format(share * 100);

  return (
    <section aria-labelledby="history-impact-title" data-testid="history-impact" className="mb-4 rounded-xl border border-line bg-card p-4">
      <h2 id="history-impact-title" className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-fg-muted">
        {t('hist_muscle_impact')}
      </h2>
      {shares.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('hist_muscle_none')}</p>
      ) : (
        <ul className="space-y-2">
          {shares.slice(0, TOP_N).map((m) => (
            <li key={m.muscle} data-testid="history-impact-row">
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="font-medium text-fg">{muscleLabel(t, m.muscle)}</span>
                <span className="font-mono text-fg-2">{t('hist_muscle_share', { pct: pct(m.share) })}</span>
              </div>
              <svg className="h-1.5 w-full" aria-hidden="true">
                <rect width="100%" height="100%" rx={3} className="fill-line" />
                <rect width={`${(m.share / top) * 100}%`} height="100%" rx={3} className="fill-accent" />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
