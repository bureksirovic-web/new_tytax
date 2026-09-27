'use client';
/**
 * Post-save progression-prompt card (family-profiles plan, piece 4): shown
 * on the debrief screen the same way `PrCelebration` is, after `save()`.
 * Readiness itself was computed from the draft + history BEFORE the save
 * (see progression-candidate.ts); this component only presents the result
 * and, on accept, swaps the exercise in the program session it came from.
 */
import { useState } from 'react';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { ProgressionCandidate } from './progression-candidate';
import '@/lib/i18n/packs/progression';

export interface ProgressCardProps {
  candidate: ProgressionCandidate;
  /** Applies the swap (progression-candidate.ts `applyProgressionSwap`); a rejection keeps the card open with an error. */
  onAccept: () => Promise<void>;
  onDismiss: () => void;
}

export function ProgressCard({ candidate, onAccept, onDismiss }: ProgressCardProps) {
  const { t } = useLocale();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const disabled = busy || (candidate.youth && !confirmed);

  async function accept() {
    if (disabled) return;
    setBusy(true);
    setFailed(false);
    try {
      await onAccept();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onDismiss} title={t('progstep_title')} size="md">
      <div data-testid="progression-card" data-exercise-id={candidate.exerciseId} data-next-exercise-id={candidate.nextExerciseId} className="space-y-4">
        <p data-testid="progression-card-body" className="text-sm text-[var(--text-secondary)]">
          {t('progstep_ready_body', { from: candidate.exerciseName, to: candidate.nextExerciseName })}
        </p>

        {candidate.youth && (
          <label className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              data-testid="progression-youth-confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>{t('progstep_youth_confirm_label')}</span>
          </label>
        )}

        {failed && (
          <p data-testid="progression-card-error" role="alert" className="rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-100">
            {t('progstep_swap_failed')}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth data-testid="progression-dismiss" disabled={busy} onClick={onDismiss}>
            {t('progstep_dismiss')}
          </Button>
          <Button fullWidth data-testid="progression-accept" disabled={disabled} loading={busy} onClick={() => void accept()}>
            {t('progstep_accept', { to: candidate.nextExerciseName })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
