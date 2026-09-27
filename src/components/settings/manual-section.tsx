'use client';
import type { TranslationKey } from '@/lib/i18n';
import { ACWR_FRESH_BELOW, ACWR_FRIED_ABOVE, RECOVERY_WINDOW_HOURS } from '@/lib/training';
import { useT } from '@/lib/i18n/use-t';
import { SettingsCard } from './settings-section';

const ENTRIES: readonly { id: string; title: TranslationKey; body: TranslationKey }[] = [
  { id: 'impact', title: 'set_manual_impact_title', body: 'set_manual_impact_body' },
  { id: 'parity', title: 'set_manual_parity_title', body: 'set_manual_parity_body' },
  { id: 'warmups', title: 'set_manual_warmups_title', body: 'set_manual_warmups_body' },
  { id: 'e1rm', title: 'set_manual_e1rm_title', body: 'set_manual_e1rm_body' },
  { id: 'rir', title: 'set_manual_rir_title', body: 'set_manual_rir_body' },
  { id: 'recovery', title: 'set_manual_recovery_title', body: 'set_manual_recovery_body' },
  { id: 'gap', title: 'set_manual_gap_title', body: 'set_manual_gap_body' },
  { id: 'backup', title: 'set_manual_backup_title', body: 'set_manual_backup_body' },
];

/** The legacy "System Manual", describing v2 behaviour, as a `<details>` accordion. */
export function ManualSection() {
  const { t } = useT();
  // Thresholds come from the training engine so the text never drifts from the code.
  const vars = { fresh: ACWR_FRESH_BELOW, fried: ACWR_FRIED_ABOVE, hours: RECOVERY_WINDOW_HOURS };
  return (
    <SettingsCard title={t('set_manual_title')} testId="settings-manual">
      <div className="divide-y divide-line">
        {ENTRIES.map((e) => (
          <details key={e.id} className="group py-1">
            <summary className="flex min-h-11 cursor-pointer items-center rounded text-sm font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400">
              {t(e.title)}
            </summary>
            <p className="pb-2 text-sm text-fg-2">{t(e.body, vars)}</p>
          </details>
        ))}
      </div>
    </SettingsCard>
  );
}
