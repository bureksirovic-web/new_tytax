'use client';
import { useState } from 'react';
import { brzycki, estimate1RM, MAX_REPS } from './rm-math';
import { parseWeightInput } from './plate-math';
import { NumberField, formatKg } from './number-field';
import { PercentTable, RepMaxTable } from './rm-tables';
import { useToolsT } from './tools-i18n';

interface RmCalculatorProps {
  initialWeightKg?: number;
  initialReps?: number;
}

export function RmCalculator({ initialWeightKg = 100, initialReps = 5 }: RmCalculatorProps) {
  const t = useToolsT();
  const [weight, setWeight] = useState(String(initialWeightKg));
  const [reps, setReps] = useState(String(initialReps));

  const weightKg = parseWeightInput(weight);
  const repCount = parseWeightInput(reps);
  const tooManyReps = Number.isInteger(repCount) && repCount > MAX_REPS;
  const valid =
    Number.isFinite(weightKg) && weightKg > 0 && Number.isInteger(repCount) && repCount >= 1 && !tooManyReps;
  const oneRm = valid ? brzycki(weightKg, repCount) : 0;
  const display = valid ? estimate1RM(weightKg, repCount) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={t('rm_weight')} value={weight} onChange={setWeight} testId="rm-weight-input" />
        <NumberField label={t('rm_reps')} value={reps} onChange={setReps} testId="rm-reps-input" integer />
      </div>

      <div aria-live="polite" className="flex items-baseline justify-between border-t border-[var(--border-color)] pt-3">
        <span className="text-xs uppercase text-[var(--text-muted)]">{t('rm_result')}</span>
        <span className="font-mono text-3xl text-[var(--text-primary)]">
          <span data-testid="rm-result">{valid ? formatKg(display) : '—'}</span>
          {valid && <span className="ml-1 text-base text-[var(--text-muted)]">{t('unit_kg')}</span>}
        </span>
      </div>

      {!valid && (
        <p role="alert" className="text-sm text-[var(--highlight)]">
          {t(tooManyReps ? 'rm_too_many_reps' : 'rm_invalid')}
        </p>
      )}

      {valid && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PercentTable oneRmKg={oneRm} />
          <RepMaxTable oneRmKg={oneRm} />
        </div>
      )}
    </div>
  );
}
