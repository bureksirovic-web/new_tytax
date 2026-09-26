'use client';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { ChoiceChips, FieldLabel, Hint } from './settings-section';
import { clampRest, formatRest, REST_MAX, REST_MIN, REST_STEP } from './settings-utils';

const QUICK = ['60', '90', '120', '180'] as const;

/** Default rest: ±15 s stepper (15–600 s) plus quick chips. */
export function RestSetting({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  const { t } = useT();
  const set = (s: number) => {
    const next = clampRest(s);
    if (next !== value) onChange(next);
  };

  return (
    <div className="space-y-2">
      <FieldLabel id="settings-rest-label">{t('set_rest_default')}</FieldLabel>
      <div className="flex items-center gap-2" role="group" aria-labelledby="settings-rest-label">
        <Button
          variant="secondary"
          size="sm"
          className="min-w-11"
          disabled={value <= REST_MIN}
          aria-label={t('set_rest_decrease', { n: REST_STEP })}
          onClick={() => set(value - REST_STEP)}
        >
          <span aria-hidden="true">−</span>
        </Button>
        <output
          data-testid="settings-rest"
          aria-live="polite"
          className="min-w-16 text-center font-mono text-lg text-fg"
        >
          {formatRest(value)}
        </output>
        <Button
          variant="secondary"
          size="sm"
          className="min-w-11"
          disabled={value >= REST_MAX}
          aria-label={t('set_rest_increase', { n: REST_STEP })}
          onClick={() => set(value + REST_STEP)}
        >
          <span aria-hidden="true">+</span>
        </Button>
      </div>
      <ChoiceChips
        name="settings-rest-quick"
        label={t('set_rest_default')}
        choices={QUICK.map((s) => ({ value: s, label: formatRest(Number(s)), testId: `settings-rest-${s}` }))}
        value={(QUICK as readonly string[]).includes(String(value)) ? (String(value) as (typeof QUICK)[number]) : undefined}
        onChange={(s) => set(Number(s))}
      />
      <Hint>{t('set_rest_hint')}</Hint>
    </div>
  );
}
