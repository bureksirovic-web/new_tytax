'use client';
import { useState } from 'react';
import type { Units } from '@/contracts/domain';
import { Button, Input } from '@/components/ui';
import { formatWeight, fromDisplayWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { FieldLabel } from './settings-section';
import { parseDecimal } from './settings-utils';
import '@/lib/i18n/packs/settings';

export const KB_MIN_KG = 2;
export const KB_MAX_KG = 60;

/** Owned kettlebells as removable chips plus an "add weight" input in the display unit. Stored in kg. */
export function KettlebellList({
  weightsKg,
  units,
  onChange,
}: {
  weightsKg: readonly number[];
  units: Units;
  onChange: (next: number[]) => void;
}) {
  const { t, locale } = useT();
  const [text, setText] = useState('');
  const parsed = parseDecimal(text);
  const kg = typeof parsed === 'number' ? fromDisplayWeight(parsed, units) : undefined;
  const valid = kg !== undefined && kg >= KB_MIN_KG && kg <= KB_MAX_KG;

  const add = () => {
    if (!valid || kg === undefined) return;
    if (!weightsKg.includes(kg)) onChange([...weightsKg, kg].sort((a, b) => a - b));
    setText('');
  };

  return (
    <div className="space-y-2">
      <FieldLabel>{t('set_eq_kettlebells')}</FieldLabel>
      {weightsKg.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid="settings-kettlebells">
          {weightsKg.map((w) => {
            const label = formatWeight(w, units, locale);
            return (
              <li key={w}>
                <button
                  type="button"
                  aria-label={t('set_eq_kettlebell_remove', { weight: label })}
                  onClick={() => onChange(weightsKg.filter((x) => x !== w))}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
                >
                  {label}
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={t('set_eq_kettlebell_weight', { unit: units })}
            inputMode="decimal"
            value={text}
            data-testid="settings-kettlebell-input"
            error={text === '' || valid ? undefined : t('set_invalid_number')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
        </div>
        <Button variant="secondary" size="md" disabled={!valid} onClick={add} data-testid="settings-kettlebell-add">
          {t('set_eq_kettlebell_add')}
        </Button>
      </div>
    </div>
  );
}
