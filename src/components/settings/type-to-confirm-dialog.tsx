'use client';
import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';

interface TypeToConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** The exact text the user must type. */
  word: string;
  inputLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  testIdPrefix: string;
}

/** A destructive confirmation that stays disabled until `word` is typed exactly. Mount with a `key` per target. */
export function TypeToConfirmDialog(props: TypeToConfirmDialogProps) {
  const { open, title, message, word, inputLabel, confirmLabel, onConfirm, onCancel, testIdPrefix } = props;
  const { t } = useT();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === word;

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) onConfirm();
        }}
      >
        <p className="text-sm text-fg-2">{message}</p>
        <Input
          label={inputLabel}
          value={typed}
          autoComplete="off"
          data-testid={`${testIdPrefix}-confirm-input`}
          onChange={(e) => setTyped(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="danger" size="sm" disabled={!matches} data-testid={`${testIdPrefix}-confirm`}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
