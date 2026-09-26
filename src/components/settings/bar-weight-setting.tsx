'use client';
import { useState } from 'react';
import type { Units } from '@/contracts/domain';
import { Input } from '@/components/ui';
import { formatWeight, fromDisplayWeight, toDisplayWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { ChoiceChips, FieldLabel } from './settings-section';
import { parseDecimal } from './settings-utils';

const PRESETS_KG = ['20', '15', '10'] as const;
export const BAR_MAX_KG = 50;

/**
 * Bar weight: 20/15/10 kg chips plus a custom value in the display unit
 * (decimals allowed, 0–50 kg). Stored in kg. Remount with `key` on unit change.
 */
export function BarWeightSetting({
  valueKg,
  units,
  onChange,
}: {
  valueKg: number;
  units: Units;
  onChange: (kg: number) => void;
}) {
  const { t, locale } = useT();
  const [text, setText] = useState(String(toDisplayWeight(valueKg, units)));
  const parsed = parseDecimal(text);
  const kg = typeof parsed === 'number' ? fromDisplayWeight(parsed, units) : undefined;
  const valid = kg !== undefined && kg >= 0 && kg <= BAR_MAX_KG;

  // The field shows the stored kg rounded to 0.1 in the display unit (20 kg → 44.1 lb).
  // Committing that untouched text would round-trip to 20.00 but 15 kg → 33.1 lb → 15.01 kg,
  // so a blur alone must never rewrite the stored value.
  const unchanged = parsed === toDisplayWeight(valueKg, units);
  const commit = () => {
    if (valid && !unchanged && kg !== valueKg) onChange(kg);
  };
  const preset = (PRESETS_KG as readonly string[]).includes(String(valueKg)) ? (String(valueKg) as (typeof PRESETS_KG)[number]) : undefined;

  return (
    <div className="space-y-2">
      <FieldLabel>{t('set_bar_weight')}</FieldLabel>
      <ChoiceChips
        name="settings-bar"
        label={t('set_bar_weight')}
        choices={PRESETS_KG.map((k) => ({ value: k, label: formatWeight(Number(k), units, locale), testId: `settings-bar-${k}` }))}
        value={preset}
        onChange={(k) => {
          setText(String(toDisplayWeight(Number(k), units)));
          onChange(Number(k));
        }}
      />
      <Input
        label={t('set_bar_weight_custom', { unit: units })}
        inputMode="decimal"
        value={text}
        data-testid="settings-bar-weight"
        hint={t('set_bar_weight_hint')}
        error={valid ? undefined : t('set_bar_weight_invalid', { max: formatWeight(BAR_MAX_KG, units, locale) })}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    </div>
  );
}
