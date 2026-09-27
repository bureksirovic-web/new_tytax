'use client';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { formatClock } from './duration';
import { averageRir, densityPerMin, durationMinutes, logHoldSeconds } from './log-math';
import '@/lib/i18n/packs/history';

function Metric({ value, label, testId }: { value: string; label: string; testId: string }) {
  return (
    <div className="rounded-lg bg-bg-2 p-2 text-center">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd data-testid={testId} className="font-mono text-lg font-bold text-accent-fg">
        {value}
      </dd>
    </div>
  );
}

/** Legacy H3 tiles, corrected: warm-ups and undone sets never count. */
export function DetailMetrics({ log, units }: { log: WorkoutLog; units: Units }) {
  const { t, locale } = useT();
  const rir = averageRir(log);
  const hold = logHoldSeconds(log);
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric testId="history-metric-duration" label={t('hist_duration')} value={t('hist_minutes', { n: durationMinutes(log.durationSeconds) })} />
      <Metric testId="history-metric-volume" label={t('hist_volume')} value={formatWeight(log.totalVolumeKg, units, locale)} />
      <Metric
        testId="history-metric-density"
        label={t('hist_density')}
        value={t('hist_density_value', { value: densityPerMin(log, units), unit: units })}
      />
      <Metric
        testId="history-metric-intensity"
        label={t('hist_intensity')}
        value={rir === null ? t('hist_none') : t('hist_intensity_value', { n: rir.toFixed(1) })}
      />
      {hold > 0 ? <Metric testId="history-metric-hold" label={t('hist_hold_time')} value={formatClock(hold)} /> : null}
      <Metric testId="history-metric-sets" label={t('hist_sets')} value={String(log.totalSets)} />
      <Metric testId="history-metric-exercises" label={t('hist_exercises')} value={String(log.exercises.length)} />
      {log.rpe != null ? (
        <Metric testId="history-rpe" label={t('hist_rpe_label')} value={String(log.rpe)} />
      ) : null}
      {log.prCount > 0 ? <Metric testId="history-metric-prs" label={t('hist_prs', { n: log.prCount })} value={String(log.prCount)} /> : null}
    </dl>
  );
}
