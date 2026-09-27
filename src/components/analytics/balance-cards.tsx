'use client';
import { useMemo } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { Card, CardHeader } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { localDay, shiftDay } from './analytics-dates';
import { movementParity } from './movement-balance';
import { num, PATTERN_KEYS } from './labels';
import { SectionTitle } from './section-title';

interface Props {
  logs: readonly WorkoutLog[];
  lookup: ExerciseLookup;
  now: Date;
}

/**
 * Movement balance over the last 30 days: volume share per movement pattern
 * against a balanced target (±5 points counts as on target; an untrained
 * pattern never does).
 * Wave 0's KineticImpactCard was dropped: its score and English explanation
 * came from `lib/analytics`, which imports the eager catalog (`@/data`).
 */
export function VolumeParityCard({ logs, lookup, now }: Props) {
  const { t, locale } = useT();
  const rows = useMemo(() => movementParity(logs, lookup, shiftDay(localDay(now), -29)), [logs, lookup, now]);
  const ok = rows.filter((r) => r.onTarget).length;

  return (
    <Card>
      <section aria-labelledby="ana-parity-title">
        <CardHeader>
          <SectionTitle id="ana-parity-title">{t('ana_parity')}</SectionTitle>
        </CardHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('ana_no_data')}</p>
        ) : (
          <>
            <ul className="space-y-3" data-testid="ana-parity-list">
              {rows.map((r) => (
                <li key={r.pattern}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="text-fg">{t(PATTERN_KEYS[r.pattern])}</span>
                    <span className="text-fg-2">{t('ana_parity_row', { pct: num(r.pct, locale), target: r.target })}</span>
                  </div>
                  <svg className="h-2 w-full" aria-hidden="true">
                    <rect width="100%" height="100%" rx={4} className="fill-line" />
                    <rect
                      width={`${Math.min(100, r.pct)}%`}
                      height="100%"
                      rx={4}
                      className={r.onTarget ? 'fill-accent' : r.pct < r.target ? 'fill-highlight' : 'fill-status-fried'}
                    />
                    <rect x={`${r.target}%`} width={2} height="100%" className="fill-fg" />
                  </svg>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-xs text-fg-2">{t('ana_parity_summary', { ok, total: rows.length })}</p>
          </>
        )}
      </section>
    </Card>
  );
}
