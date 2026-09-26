'use client';
import type { PRType, Units } from '@/contracts/domain';
import type { PRCandidate } from '@/contracts/training';
import { kgToDisplay } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useFinishStrings } from '@/components/workout/strings/finish';

type FinishT = ReturnType<typeof useFinishStrings>;

const TYPE_KEY = {
  e1rm: 'pr_type_e1rm',
  weight: 'pr_type_weight',
  reps: 'pr_type_reps',
  volume: 'pr_type_volume',
} as const satisfies Record<PRType, string>;

/** kg-valued PR (e1rm, weight, volume) in display units, one decimal at most. */
export function prDisplayValue(prType: PRType, value: number, units: Units): number {
  if (prType === 'reps') return Math.round(value);
  return Math.round(kgToDisplay(value, units) * 10) / 10;
}

function valueText(t: FinishT, pr: PRCandidate, value: number, units: Units, previous: boolean): string {
  const shown = prDisplayValue(pr.prType, value, units);
  if (pr.prType === 'reps') return t(previous ? 'pr_previous_reps' : 'pr_value_reps', { value: shown });
  return t(previous ? 'pr_previous_weight' : 'pr_value_weight', { value: shown, unit: units });
}

export interface PrCelebrationProps {
  prs: readonly PRCandidate[];
  units: Units;
  onContinue: () => void;
}

/** Shown after a save that set at least one non-baseline PR. */
export function PrCelebration({ prs, units, onContinue }: PrCelebrationProps) {
  const t = useFinishStrings();
  return (
    <Modal open onClose={onContinue} title={t('pr_title')} size="md">
      <div data-testid="pr-celebration" className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">{t('pr_intro', { n: prs.length })}</p>
        <ul className="space-y-2">
          {prs.map((pr) => (
            <li
              key={`${pr.setId}-${pr.prType}`}
              data-testid="pr-celebration-item"
              data-pr-type={pr.prType}
              data-exercise-id={pr.exerciseId}
              className="rounded-lg border border-[var(--accent)] bg-[var(--bg-secondary)] p-3"
            >
              <p className="font-semibold text-[var(--text-primary)]">{pr.exerciseName}</p>
              <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{t(TYPE_KEY[pr.prType])}</p>
              <p className="font-mono text-lg font-bold text-[var(--highlight)]">
                <span data-testid="pr-celebration-value">{valueText(t, pr, pr.value, units, false)}</span>
                {pr.previousBest !== null && (
                  <span data-testid="pr-celebration-previous" className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
                    {valueText(t, pr, pr.previousBest, units, true)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
        <Button data-testid="pr-celebration-continue" size="lg" fullWidth onClick={onContinue} className="uppercase tracking-widest">
          {t('pr_continue')}
        </Button>
      </div>
    </Modal>
  );
}
