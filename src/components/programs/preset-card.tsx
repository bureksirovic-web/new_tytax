'use client';
import type { ProgramTemplate } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { BW_YOUTH_DIPBAR_START_PRESET_ID } from '@/data/bodyweight/presets';
import { MODALITY_KEYS, SPLIT_KEYS } from './lib/labels';
import '@/lib/i18n/packs/programs';
import '@/lib/i18n/packs/youth';

interface PresetCardProps {
  preset: ProgramTemplate;
  installed: boolean;
  busy: boolean;
  disabled: boolean;
  onInstall: (activate: boolean) => void;
}

/**
 * A built-in preset. Default action installs and activates (legacy parity); secondary installs only.
 * e2e hooks (G3-03): the primary control is `install-preset`, install-only is `install-preset-only`,
 * both carry `data-preset-id`.
 */
export function PresetCard({ preset, installed, busy, disabled, onInstall }: PresetCardProps) {
  const { t } = useT();
  const training = preset.sessions.filter((s) => !s.isRest).length;
  return (
    <article data-testid="preset-card" className="rounded-xl border border-line bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-base font-semibold text-fg">{preset.name}</h3>
        {installed ? <Badge variant="success">{t('prog_installed')}</Badge> : null}
      </div>
      <p className="text-xs text-fg-muted">
        {t(SPLIT_KEYS[preset.splitType])} · {t('prog_days_per_week', { n: preset.frequency })} ·{' '}
        {t('prog_sessions_count', { n: training })}
      </p>
      <p className="mt-1 text-xs text-fg-2">{preset.modalitiesUsed.map((m) => t(MODALITY_KEYS[m])).join(' · ')}</p>
      {preset.presetId === BW_YOUTH_DIPBAR_START_PRESET_ID && (
        <p className="mt-2 rounded-lg border border-line bg-bg-2 p-2 text-xs text-fg" data-testid="preset-youth-safety">
          {t('youth_preset_safety')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {installed ? (
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={disabled}
            onClick={() => onInstall(false)}
            data-testid="install-preset"
            data-preset-id={preset.presetId}
          >
            {t('prog_install_again')}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={disabled}
              onClick={() => onInstall(true)}
              data-testid="install-preset"
              data-preset-id={preset.presetId}
            >
              {t('prog_install_activate')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => onInstall(false)}
              data-testid="install-preset-only"
              data-preset-id={preset.presetId}
            >
              {t('prog_install_only')}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
