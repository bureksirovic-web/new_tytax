'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { WorkoutDraft } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ArrowRightIcon } from '@/components/workout/icons';
import { useStartStrings } from '@/components/workout/strings/start';

export interface StartDraftCardProps {
  draft: WorkoutDraft;
  onDiscard: () => void;
}

/** The workout in progress: continue it, or discard it after a confirmation. */
export function StartDraftCard({ draft, onDiscard }: StartDraftCardProps) {
  const locale = useLocale();
  const t = useStartStrings();
  const [confirming, setConfirming] = useState(false);

  return (
    <section data-testid="current-draft" className="mb-6 rounded-xl border border-[var(--accent)] bg-[var(--bg-card)] p-4">
      <p className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">{locale.t('workout_session_active')}</p>
      <Link
        href="/workout/active"
        data-testid="continue-workout"
        aria-label={`${t('continue_workout')}: ${draft.sessionName}`}
        className="mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-od-green-500 bg-od-green-600 px-4 py-2 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-od-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <span className="truncate">{draft.sessionName}</span>
        <ArrowRightIcon className="h-5 w-5 shrink-0" />
      </Link>
      <Button
        data-testid="discard-workout"
        variant="danger"
        fullWidth
        onClick={() => setConfirming(true)}
        className="uppercase tracking-wider"
      >
        {t('discard_workout')}
      </Button>

      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('discard_title')} size="sm">
        <div data-testid="discard-confirm-dialog" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{t('discard_message', { name: draft.sessionName })}</p>
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
    </section>
  );
}
