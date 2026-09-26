'use client';
import { useState } from 'react';
import type { SetEntry } from '@/contracts/domain';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSetsStrings } from './strings/sets';
import { CloseIcon } from './icons';
import { setHasData } from './set-rules';

export interface SetRemoveButtonProps {
  set: SetEntry;
  label: string;
  onRemove: () => void;
}

/** Deletes an empty set at once; a set with entered data asks first (ConfirmDialog). */
export function SetRemoveButton({ set, label, onRemove }: SetRemoveButtonProps) {
  const t = useSetsStrings();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="remove-set"
        aria-label={label}
        onClick={() => (setHasData(set) ? setConfirming(true) : onRemove())}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={confirming}
        title={t('set_remove_title')}
        message={t('set_remove_message')}
        confirmLabel={t('set_remove_confirm')}
        cancelLabel={t('set_remove_cancel')}
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    </>
  );
}
