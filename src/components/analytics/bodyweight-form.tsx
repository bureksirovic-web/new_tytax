'use client';
import { useState } from 'react';
import type { BodyweightEntry, Units } from '@/contracts/domain';
import { Button, Input } from '@/components/ui';
import { formatWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { localDay } from './analytics-dates';
import { BW_MAX_KG, BW_MIN_KG, parseBodyweight, toInputValue } from './labels';

export interface BodyweightSubmit {
  date: string;
  valueKg: number;
  editingId?: string;
}

interface Props {
  units: Units;
  /** Entry being edited; mount with a new `key` when it changes. */
  editing?: BodyweightEntry;
  saving?: boolean;
  onSubmit: (value: BodyweightSubmit) => Promise<boolean>;
  onCancelEdit: () => void;
}

/** Bodyweight entry form: value in the profile's units (stored as kg), date defaults to today. */
export function BodyweightForm({ units, editing, saving, onSubmit, onCancelEdit }: Props) {
  const { t, locale } = useT();
  const today = localDay(new Date());
  const initialValue = editing ? toInputValue(editing.valueKg, units) : '';
  const [value, setValue] = useState(initialValue);
  const [date, setDate] = useState(editing?.date ?? today);
  const [valueError, setValueError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseBodyweight(value, units);
    const badDate = !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today;
    setValueError(
      parsed.ok ? undefined : t('ana_bw_invalid', { min: formatWeight(BW_MIN_KG, units, locale), max: formatWeight(BW_MAX_KG, units, locale) }),
    );
    setDateError(badDate ? t('ana_bw_invalid_date') : undefined);
    if (!parsed.ok || badDate) return;
    // An untouched value keeps the stored kg: 80 kg shows as 176.4 lb, which converts back to 80.01 kg.
    const valueKg = editing && value === initialValue ? editing.valueKg : parsed.kg;
    const ok = await onSubmit({ date, valueKg, editingId: editing?.id });
    if (ok && !editing) setValue('');
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start" data-testid="ana-bw-form">
      <Input
        label={t('ana_bw_input_label', { unit: units })}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={valueError}
      />
      <Input
        label={t('ana_bw_date')}
        type="date"
        max={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={dateError}
      />
      <div className="flex gap-2 sm:mt-5">
        <Button type="submit" loading={saving}>
          {editing ? t('ana_bw_update') : t('ana_save')}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancelEdit}>
            {t('ana_bw_cancel_edit')}
          </Button>
        )}
      </div>
    </form>
  );
}
