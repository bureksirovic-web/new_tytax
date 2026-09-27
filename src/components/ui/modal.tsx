'use client';
import { CloseIcon } from './icons';
import { useId, useRef } from 'react';
import { useLocale } from '@/components/providers';
import { useDialog } from './use-dialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Accessible name when no visible title is rendered. */
  ariaLabel?: string;
}

const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, children, size = 'md', ariaLabel }: ModalProps) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, onClose, dialogRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} rounded-xl border border-line bg-card shadow-2xl focus:outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 id={titleId} className="font-display text-sm font-semibold uppercase tracking-widest text-highlight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-gunmetal-700 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
              aria-label={t('close')}
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
