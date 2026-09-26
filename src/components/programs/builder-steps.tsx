'use client';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/use-t';
import { FREQ_OPTIONS, splitOptions, slotNames, type BuilderSplit } from './lib/builder';
import { SPLIT_KEYS } from './lib/labels';

const optionCls =
  'flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left text-fg transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';

/** Step 1: training days per week (2–6). Tap = select and continue (legacy L4057-4078). */
export function StepFrequency({ onPick }: { onPick: (days: number) => void }) {
  const { t } = useT();
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-fg">{t('prog_builder_how_many_days')}</legend>
      <ul className="grid grid-cols-5 gap-2">
        {FREQ_OPTIONS.map((d) => (
          <li key={d}>
            <button
              type="button"
              onClick={() => onPick(d)}
              aria-label={t('prog_builder_days_n', { n: d })}
              className={`${optionCls} justify-center font-display text-xl font-bold`}
            >
              {d}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Step 2: split; the two recommended for `days` first, the third under "Other" (legacy L4080-4105). */
export function StepSplit({ days, busy, onPick }: { days: number; busy: boolean; onPick: (split: BuilderSplit) => void }) {
  const { t } = useT();
  const options = splitOptions(days);
  const recommended = options.filter((o) => o.recommended);
  const other = options.filter((o) => !o.recommended);

  const renderOption = (split: BuilderSplit, isRecommended: boolean) => (
    <li key={split}>
      <button type="button" disabled={busy} onClick={() => onPick(split)} className={optionCls}>
        <span className="min-w-0">
          <span className="block font-semibold">{t(SPLIT_KEYS[split])}</span>
          <span className="block text-xs text-fg-muted">{slotNames(split, days).join(' · ')}</span>
        </span>
        {isRecommended ? <Badge variant="success">{t('prog_builder_recommended')}</Badge> : null}
      </button>
    </li>
  );

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-fg">{t('prog_builder_split')}</legend>
      <p className="mb-3 text-xs text-fg-muted">{t('prog_builder_recommended_for', { days })}</p>
      <ul className="flex flex-col gap-2">{recommended.map((o) => renderOption(o.split, true))}</ul>
      <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-fg-muted">{t('prog_builder_other')}</h2>
      <ul className="flex flex-col gap-2">{other.map((o) => renderOption(o.split, false))}</ul>
    </fieldset>
  );
}
