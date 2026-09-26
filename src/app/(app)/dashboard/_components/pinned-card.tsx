'use client';
import Link from 'next/link';
import type { Units } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { cardSection, eyebrow } from './styles';
import { usePinnedLifts } from './use-pinned-lifts';

/** Shown in place of a value when a pinned exercise has no e1RM yet (notation, not copy). */
const NONE = '—';

/** Compact list of the profile's pinned exercises with their latest-session best e1RM; hidden when nothing is pinned. */
export function PinnedCard({ units }: { units: Units }) {
  const { t, locale } = useT();
  const { lifts, loading, failed } = usePinnedLifts();

  if (failed) {
    return (
      <p role="alert" data-testid="dash-pinned-error" className={`${cardSection} text-sm text-fg`}>
        {t('dash_pinned_failed')}
      </p>
    );
  }
  if (loading || lifts.length === 0) return null;

  return (
    <section aria-labelledby="dash-pinned-heading" data-testid="dash-pinned" className={cardSection}>
      <h2 id="dash-pinned-heading" className={eyebrow}>
        {t('dash_pinned')}
      </h2>
      <p className="mb-2 text-xs text-fg-muted">{t('dash_pinned_caption')}</p>
      <ul className="divide-y divide-line" data-testid="dash-pinned-list">
        {lifts.map((lift, i) => (
          <li key={lift.exerciseId} data-testid="dash-pinned-item" data-exercise-id={lift.exerciseId}>
            <Link
              href={`/analytics/${encodeURIComponent(lift.exerciseId)}`}
              aria-label={t('dash_pinned_open', { name: lift.name })}
              aria-describedby={`dash-pinned-value-${i}`}
              className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
            >
              <span className="truncate text-sm font-medium text-fg">{lift.name}</span>
              <span
                id={`dash-pinned-value-${i}`}
                data-testid="dash-pinned-value"
                className="shrink-0 font-mono text-sm text-highlight"
              >
                {lift.latest ? (
                  formatWeight(lift.latest.e1rm, units, locale)
                ) : (
                  <>
                    <span aria-hidden="true">{NONE}</span>
                    <span className="sr-only">{t('dash_pinned_no_data')}</span>
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
