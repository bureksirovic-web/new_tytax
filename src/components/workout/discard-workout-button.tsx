'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useStartStrings } from '@/components/workout/strings/start';

export interface DiscardWorkoutButtonProps {
  sessionName: string;
  onDiscard: () => void;
  variant?: 'danger' | 'ghost';
}

/** Discards the workout in progress only after a confirmation (a mis-tap never loses logged sets). */
export function DiscardWorkoutButton({ sessionName, onDiscard, variant = 'danger' }: DiscardWorkoutButtonProps) {
  const t = useStartStrings();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        data-testid="discard-workout"
        variant={variant}
        fullWidth
        onClick={() => setConfirming(true)}
        className="uppercase tracking-wider"
      >
        {t('discard_workout')}
      </Button>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('discard_title')} size="sm">
        <div data-testid="discard-confirm-dialog" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('discard_message', { name: sessionName })}</p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              data-testid="discard-confirm"
              variant="danger"
              fullWidth
              onClick={() => {
                setConfirming(false);
                onDiscard();
              }}
            >
              {t('discard_confirm')}
            </Button>
            <Button data-testid="discard-cancel" variant="secondary" fullWidth onClick={() => setConfirming(false)}>
              {t('discard_keep')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
