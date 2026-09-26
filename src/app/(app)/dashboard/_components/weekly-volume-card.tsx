'use client';
import type { Units } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import type { WeeklyVolume } from './dashboard-math';
import { cardSection, eyebrow } from './styles';

export interface WeeklyVolumeCardProps {
  volume: WeeklyVolume;
  units: Units;
}

/** Bar length in viewBox units (0–100) relative to the larger week. */
function barLength(value: number, max: number): number {
  return max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
}

/** Done working-set volume, this ISO week vs last, with a text summary for screen readers. */
export function WeeklyVolumeCard({ volume, units }: WeeklyVolumeCardProps) {
  const { t, locale } = useT();
  const current = formatWeight(volume.thisWeekKg, units, locale);
  const previous = formatWeight(volume.lastWeekKg, units, locale);
  const max = Math.max(volume.thisWeekKg, volume.lastWeekKg);
  const { changePct } = volume;
  const change =
    changePct === null
      ? t('dash_volume_no_last_week')
      : changePct > 0
        ? t('dash_volume_up', { pct: changePct })
        : changePct < 0
          ? t('dash_volume_down', { pct: Math.abs(changePct) })
          : t('dash_volume_same');

  const rows = [
    { key: 'this', label: t('dash_this_week'), value: current, len: barLength(volume.thisWeekKg, max), fill: 'fill-accent' },
    { key: 'last', label: t('dash_last_week'), value: previous, len: barLength(volume.lastWeekKg, max), fill: 'fill-fg-muted' },
  ];

  return (
    <section aria-labelledby="dash-volume-heading" data-testid="dash-weekly-volume" className={cardSection}>
      <h2 id="dash-volume-heading" className={`${eyebrow} mb-1`}>
        {t('dash_weekly_volume')}
      </h2>
      <p className="mb-3 text-xs text-fg-muted">{t('dash_volume_caption')}</p>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <dt className="text-fg-2">{r.label}</dt>
              <dd data-testid={`dash-volume-${r.key}`} className="font-mono font-semibold text-fg">
                {r.value}
              </dd>
            </div>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1 h-2 w-full" aria-hidden="true">
              <rect x="0" y="0" width="100" height="4" rx="2" className="fill-bg-2" />
              <rect x="0" y="0" width={r.len} height="4" rx="2" className={r.fill} />
            </svg>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-fg-2" data-testid="dash-volume-change">
        {change}
      </p>
      <p className="sr-only">{t('dash_volume_summary', { current, previous })}</p>
    </section>
  );
}
