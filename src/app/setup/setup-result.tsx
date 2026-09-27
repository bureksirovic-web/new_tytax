'use client';
import { useT } from '@/lib/i18n/use-t';
import { Badge } from '@/components/ui';
import type { TranslationKey } from '@/lib/i18n';
import type { SetupProfileResult, SetupProfileStatus } from './setup-actions';
import '@/lib/i18n/packs/setup';

const MESSAGE_KEY: Record<SetupProfileStatus, TranslationKey> = {
  created: 'link_result_created',
  adopted: 'link_result_adopted',
  skipped: 'link_result_skipped',
};

const BADGE_KEY: Record<SetupProfileStatus, TranslationKey> = {
  created: 'link_status_created',
  adopted: 'link_status_adopted',
  skipped: 'link_status_skipped',
};

const BADGE_VARIANT: Record<SetupProfileStatus, 'success' | 'default'> = {
  created: 'success',
  adopted: 'success',
  skipped: 'default',
};

/** Per-profile report after "Create": created, adopted (the ADOPT rule) or skipped (already set up). */
export function SetupResult({ results }: { results: readonly SetupProfileResult[] }) {
  const { t } = useT();

  return (
    <div className="space-y-4" data-testid="setup-result">
      <h1 className="font-display text-lg font-semibold uppercase tracking-wide text-[var(--text-primary)]">
        {t('link_result_title')}
      </h1>
      <ul className="space-y-2" data-testid="setup-result-list">
        {results.map((r) => (
          <li
            key={r.profileId}
            data-testid={`setup-result-row-${r.status}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
          >
            <span className="text-sm text-[var(--text-primary)]">
              {t(MESSAGE_KEY[r.status], { name: r.input.name, program: r.programName })}
            </span>
            <Badge variant={BADGE_VARIANT[r.status]}>{t(BADGE_KEY[r.status])}</Badge>
          </li>
        ))}
      </ul>
      {/* A real link, not router.push: a full navigation runs the app's normal bootstrap
          on /dashboard (AppBootstrap skips it only on /setup). */}
      <a
        href="/dashboard"
        data-testid="setup-go-dashboard"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-od-green-500 bg-od-green-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-od-green-500"
      >
        {t('link_result_dashboard')}
      </a>
    </div>
  );
}
