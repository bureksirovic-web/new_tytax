'use client';
import { useLocale } from '@/components/providers';
import { Modal } from './modal';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onConfirm, onCancel, title, message, confirmLabel, cancelLabel, danger }: ConfirmDialogProps) {
  const { t } = useLocale();
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-fg-2">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>{cancelLabel ?? t('cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel ?? t('confirm')}</Button>
        </div>
      </div>
    </Modal>
  );
}
