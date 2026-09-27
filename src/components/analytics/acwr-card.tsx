'use client';
import { useMemo } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { Badge, Card, CardHeader } from '@/components/ui';
import { SectionTitle } from './section-title';
import { useT } from '@/lib/i18n/use-t';
import { ACWR_BASELINE_DAYS, acwrSummary, type AcwrZone } from './analytics-math';
import { muscleLabel, num, ZONE_KEYS } from './labels';
import '@/lib/i18n/packs/analytics';

interface Props {
  logs: readonly WorkoutLog[];
  lookup: ExerciseLookup;
  now: Date;
  /** Youth mode (profile under 16): no load-spike (caution/danger) zone warnings. */
  hideSpikeWarnings?: boolean;
}

const ZONE_BADGE: Record<AcwrZone, 'default' | 'success' | 'warning' | 'danger'> = {
  undertrain: 'default',
  optimal: 'success',
  caution: 'warning',
  danger: 'danger',
};

/** Ratio of a muscle whose baseline is still building (notation, not copy). */
const NONE = '—';
const TH = 'py-2 pr-2 text-left font-medium text-fg-muted';
const TD = 'py-2 pr-2 font-mono text-fg-2';

/**
 * Today's acute:chronic ratio per muscle. With under 28 days of history the
 * chronic baseline is not real yet, so only acute load is shown, never a zone
 * (a new user must not see a fake "danger"). The same holds per muscle: a
 * muscle first trained < 28 days ago shows its own building notice, no zone.
 */
export function AcwrCard({ logs, lookup, now, hideSpikeWarnings }: Props) {
  const { t, locale } = useT();
  const { rows, daysOfHistory, building } = useMemo(() => acwrSummary(logs, lookup, now), [logs, lookup, now]);

  return (
    <Card>
      <section aria-labelledby="ana-acwr-title">
        <CardHeader>
          <SectionTitle id="ana-acwr-title">{t('ana_acwr_title')}</SectionTitle>
        </CardHeader>
        <p className="mb-3 text-xs text-fg-2">{t('ana_acwr_caption')}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted" role="status">{t('ana_acwr_none')}</p>
        ) : (
          <>
            {building && (
              <p className="mb-3 rounded-lg border border-line bg-bg-2 p-3 text-sm text-fg" role="status" data-testid="ana-acwr-building">
                {t('ana_acwr_building', { days: Math.min(daysOfHistory, ACWR_BASELINE_DAYS) })}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs">
                    <th scope="col" className={TH}>{t('ana_col_muscle')}</th>
                    <th scope="col" className={TH}>{t('ana_col_acute')}</th>
                    {!building && <th scope="col" className={TH}>{t('ana_col_chronic')}</th>}
                    {!building && <th scope="col" className={TH}>{t('ana_col_ratio')}</th>}
                    {!building && <th scope="col" className={TH}>{t('ana_col_zone')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.muscle} className="border-b border-line/50 last:border-0">
                      <th scope="row" className="py-2 pr-2 text-left font-medium text-fg">{muscleLabel(t, r.muscle)}</th>
                      <td className={TD}>{num(r.acute, locale)}</td>
                      {!building && <td className={TD}>{num(r.chronic, locale)}</td>}
                      {!building && <td className={TD}>{r.building ? NONE : num(r.ratio, locale, 2)}</td>}
                      {!building && (
                        <td className="py-2">
                          {r.building ? (
                            <span className="text-xs text-fg-muted">{t('ana_acwr_row_building', { days: r.baselineDays })}</span>
                          ) : hideSpikeWarnings && (r.zone === 'caution' || r.zone === 'danger') ? (
                            <span className="text-xs text-fg-muted">{NONE}</span>
                          ) : (
                            <Badge variant={ZONE_BADGE[r.zone]}>{t(ZONE_KEYS[r.zone])}</Badge>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!building && rows.some((r) => r.building) && (
              <p className="mt-3 text-xs text-fg-muted" data-testid="ana-acwr-row-building">{t('ana_acwr_row_building_note')}</p>
            )}
            {!building && <p className="mt-3 text-xs text-fg-muted">{t('ana_acwr_legend')}</p>}
          </>
        )}
      </section>
    </Card>
  );
}
