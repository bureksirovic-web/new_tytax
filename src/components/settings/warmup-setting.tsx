'use client';
import type { Units, WarmupStrategy } from '@/contracts/domain';
import { formatWeight } from '@/lib/i18n';
import { training } from '@/lib/training';
import { useT } from '@/lib/i18n/use-t';
import { ChoiceChips, FieldLabel, Hint } from './settings-section';

const STRATEGIES: readonly WarmupStrategy[] = ['standard', 'heavy', 'pyramid', 'none'];
const LABEL = {
  standard: 'set_warmup_standard',
  heavy: 'set_warmup_heavy',
  pyramid: 'set_warmup_pyramid',
  none: 'set_warmup_none',
} as const satisfies Record<WarmupStrategy, string>;

/** The example working weight of the live preview, kg. */
export const PREVIEW_WORKING_KG = 100;

/** Warm-up strategy radio group with a live preview from the training engine. */
export function WarmupSetting({
  value,
  barKg,
  units,
  onChange,
}: {
  value: WarmupStrategy;
  barKg: number;
  units: Units;
  onChange: (strategy: WarmupStrategy) => void;
}) {
  const { t, locale } = useT();
  const sets = training.generateWarmups(PREVIEW_WORKING_KG, value, { barKg });

  return (
    <div className="space-y-2">
      <FieldLabel>{t('set_warmup_strategy')}</FieldLabel>
      <ChoiceChips
        name="settings-warmup"
        label={t('set_warmup_strategy')}
        choices={STRATEGIES.map((s) => ({ value: s, label: t(LABEL[s]), testId: `settings-warmup-${s}` }))}
        value={value}
        onChange={onChange}
      />
      <div className="rounded-lg bg-card p-3" data-testid="settings-warmup-preview" aria-live="polite">
        <Hint>{t('set_warmup_preview', { weight: formatWeight(PREVIEW_WORKING_KG, units, locale) })}</Hint>
        {sets.length === 0 ? (
          <p className="mt-1 text-sm text-fg-2">{t('set_warmup_preview_none')}</p>
        ) : (
          <ol className="mt-1 space-y-0.5 font-mono text-sm text-fg">
            {sets.map((s) => (
              <li key={s.id}>{t('set_warmup_set', { weight: formatWeight(s.kg ?? 0, units, locale), reps: s.reps ?? 0 })}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
