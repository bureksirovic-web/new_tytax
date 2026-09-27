'use client';
import type { RecoveryState, RecoverySummary } from '@/contracts/training';
import type { TranslationKey } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/use-t';
import { muscleLabel } from './muscle-names';
import { cardSection, eyebrow } from './styles';
import '@/lib/i18n/packs/dashboard';

const STATUS_KEY: Readonly<Record<RecoveryState, TranslationKey>> = {
  fresh: 'dash_status_fresh',
  recovering: 'dash_status_recovering',
  fried: 'dash_status_fried',
};

const STATUS_TEXT: Readonly<Record<RecoveryState, string>> = {
  fresh: 'text-status-fresh',
  recovering: 'text-status-recovering',
  fried: 'text-status-fried',
};

const STATUS_DOT: Readonly<Record<RecoveryState, string>> = {
  fresh: 'bg-status-fresh',
  recovering: 'bg-status-recovering',
  fried: 'bg-status-fried',
};

/** How many of the most loaded muscles to list. */
export const WORST_MUSCLES = 3;

/** Overall recovery plus the most loaded muscles of the last 48 h (`training.recoveryStatus`). */
export function RecoveryCard({ recovery, failed = false }: { recovery: RecoverySummary | undefined; failed?: boolean }) {
  const { t } = useT();
  const worst = recovery ? recovery.muscles.filter((m) => m.load48h > 0).slice(0, WORST_MUSCLES) : [];

  return (
    <section aria-labelledby="dash-recovery-heading" data-testid="dash-recovery" className={cardSection}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="dash-recovery-heading" className={eyebrow}>
          {t('dash_recovery')}
        </h2>
        <span className="text-xs text-fg-muted">{t('dash_recovery_caption')}</span>
      </div>
      {!recovery && failed ? (
        <p role="alert" data-testid="dash-recovery-failed" className="text-sm text-fg-2">
          {t('dash_recovery_failed')}
        </p>
      ) : !recovery ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <>
          <p role="status" data-testid="dash-recovery-overall" className={`font-display text-2xl font-bold uppercase ${STATUS_TEXT[recovery.overall]}`}>
            {t('dash_recovery_overall', { status: t(STATUS_KEY[recovery.overall]) })}
          </p>
          {recovery.overall === 'fried' && (
            <p data-testid="dash-fried-hint" className="mt-1 text-sm text-fg-2">
              {t('dash_recovery_fried_hint')}
            </p>
          )}
          {worst.length === 0 ? (
            <p className="mt-2 text-sm text-fg-2">{t('dash_recovery_all_fresh')}</p>
          ) : (
            <div className="mt-3">
              <h3 className="mb-1 text-xs text-fg-muted">{t('dash_recovery_most_loaded')}</h3>
              <ul className="space-y-1" data-testid="dash-recovery-muscles">
                {worst.map((m) => (
                  <li key={m.muscle} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-fg">
                      <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[m.status]}`} />
                      {muscleLabel(m.muscle, t)}
                    </span>
                    <span className="text-fg-2">
                      <span className={STATUS_TEXT[m.status]}>{t(STATUS_KEY[m.status])}</span>
                      {m.hoursSince !== null && (
                        <span className="ml-2 font-mono text-xs text-fg-muted">
                          {t('dash_recovery_hours_ago', { hours: Math.round(m.hoursSince) })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
