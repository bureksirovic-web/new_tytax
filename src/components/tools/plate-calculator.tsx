'use client';
import { useState } from 'react';
import { calcPlates, parseWeightInput, DEFAULT_BAR_KG, DEFAULT_PLATES_KG, MAX_TARGET_KG } from './plate-math';
import { NumberField, formatKg } from './number-field';
import { useToolsT } from './tools-i18n';

interface PlateCalculatorProps {
  initialTargetKg?: number;
  initialBarKg?: number;
  /** Plate sizes (kg, per side). Default: the standard set. */
  platesKg?: readonly number[];
}

/** Plate diameter class by size so heavier plates read as bigger discs. */
function plateSizeClass(kg: number): string {
  if (kg >= 20) return 'h-16 w-16 text-base';
  if (kg >= 10) return 'h-14 w-14 text-sm';
  if (kg >= 5) return 'h-12 w-12 text-sm';
  return 'h-11 w-11 text-xs';
}

export function PlateCalculator({
  initialTargetKg = 100,
  initialBarKg = DEFAULT_BAR_KG,
  platesKg = DEFAULT_PLATES_KG,
}: PlateCalculatorProps) {
  const t = useToolsT();
  const [target, setTarget] = useState(String(initialTargetKg));
  const [bar, setBar] = useState(String(initialBarKg));

  const targetKg = parseWeightInput(target);
  const barKg = parseWeightInput(bar);
  const tooHeavy = Number.isFinite(targetKg) && targetKg > MAX_TARGET_KG;
  const valid =
    Number.isFinite(targetKg) && targetKg > 0 && !tooHeavy && Number.isFinite(barKg) && barKg >= 0;
  const result = calcPlates({ targetKg, barKg, plates: platesKg });
  const belowBar = valid && targetKg < barKg;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={t('plate_target')} value={target} onChange={setTarget} testId="plate-target-input" />
        <NumberField label={t('plate_bar')} value={bar} onChange={setBar} testId="plate-bar-input" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm uppercase text-[var(--text-muted)]">
          {t('plate_per_side')}
        </h2>
        <ul data-testid="plate-per-side" className="flex min-h-16 flex-wrap items-center gap-2">
          {result.perSide.map((kg, i) => (
            <li
              key={`${kg}-${i}`}
              data-testid="plate-item"
              className={`flex items-center justify-center rounded-full border-4 border-[var(--border-color)] bg-[var(--bg-secondary)] font-mono font-bold text-[var(--text-primary)] ${plateSizeClass(kg)}`}
            >
              {formatKg(kg)}
            </li>
          ))}
        </ul>
        {valid && !belowBar && result.perSide.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">{t('plate_bar_only')}</p>
        )}

        <div aria-live="polite" className="flex items-baseline justify-between border-t border-[var(--border-color)] pt-3">
          <span className="text-xs uppercase text-[var(--text-muted)]">{t('plate_loaded')}</span>
          <span data-testid="plate-loaded-total" className="font-mono text-2xl text-[var(--text-primary)]">
            {valid ? `${formatKg(result.loadedKg)} ${t('unit_kg')}` : '—'}
          </span>
        </div>

        {!valid && (
          <p role="alert" className="text-sm text-[var(--highlight)]">
            {t(tooHeavy ? 'plate_too_heavy' : 'plate_invalid')}
          </p>
        )}
        {belowBar && (
          <p role="alert" className="text-sm text-[var(--highlight)]">{t('plate_below_bar')}</p>
        )}
        {valid && !belowBar && !result.achievable && (
          <p data-testid="plate-remainder" className="text-sm text-[var(--highlight)]">
            {t('plate_remainder')} {formatKg(result.remainderKg)} {t('unit_kg')}
          </p>
        )}
      </section>
    </div>
  );
}
