'use client';
import type { WeakPointPick } from '@/stores/session-builder';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useStartStrings } from '@/components/workout/strings/start';
import { useMuscleName } from '@/components/workout/strings/muscles';

interface OfferActionsProps {
  prefix: 'deload' | 'weak-point';
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}

function OfferActions({ prefix, acceptLabel, declineLabel, onAccept, onDecline }: OfferActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row-reverse">
      <Button data-testid={`${prefix}-accept`} fullWidth onClick={onAccept} className="uppercase tracking-wider">
        {acceptLabel}
      </Button>
      <Button data-testid={`${prefix}-decline`} fullWidth variant="secondary" onClick={onDecline} className="uppercase tracking-wider">
        {declineLabel}
      </Button>
    </div>
  );
}

export interface OfferDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Escape / backdrop: abandon the start without choosing. */
  onCancel: () => void;
}

/** Recovery is 'fried': offer -1 set per exercise and -15 % load. */
export function DeloadOfferDialog({ open, onAccept, onDecline, onCancel }: OfferDialogProps) {
  const t = useStartStrings();
  return (
    <Modal open={open} onClose={onCancel} title={t('deload_title')} size="sm">
      <div data-testid="deload-offer" className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">{t('deload_body')}</p>
        <OfferActions
          prefix="deload"
          acceptLabel={t('deload_accept')}
          declineLabel={t('deload_decline')}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      </div>
    </Modal>
  );
}

/** Weak-point injector: a lagging muscle and the exercise (+2 sets) that trains it. */
export function WeakPointOfferDialog({ open, pick, onAccept, onDecline, onCancel }: OfferDialogProps & { pick: WeakPointPick | undefined }) {
  const t = useStartStrings();
  const muscleName = useMuscleName();
  return (
    <Modal open={open && pick !== undefined} onClose={onCancel} title={t('weak_title')} size="sm">
      {pick && (
        <div data-testid="weak-point-offer" className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('weak_body', { muscle: muscleName(pick.muscle), exercise: pick.exercise.name, sets: pick.sets })}
          </p>
          <p data-testid="weak-point-exercise" className="font-semibold text-[var(--accent)]">
            {pick.exercise.name}
          </p>
          <OfferActions
            prefix="weak-point"
            acceptLabel={t('weak_accept')}
            declineLabel={t('weak_decline')}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        </div>
      )}
    </Modal>
  );
}
