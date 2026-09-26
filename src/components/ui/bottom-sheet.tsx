'use client';
import { useId, useRef } from 'react';
import { useLocale } from '@/components/providers';
import { useDialog } from './use-dialog';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: ('half' | 'full')[];
  /** Accessible name when no visible title is rendered. */
  ariaLabel?: string;
}

export function BottomSheet({ open, onClose, title, children, ariaLabel }: BottomSheetProps) {
  const { t } = useLocale();
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, onClose, sheetRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl border-t border-line bg-card shadow-2xl focus:outline-none md:max-w-lg md:rounded-xl md:border"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className="absolute left-1/2 top-2 mx-auto h-1 w-10 -translate-x-1/2 rounded-full bg-gunmetal-600 md:hidden" aria-hidden="true" />
          {title ? (
            <h2 id={titleId} className="font-display text-sm font-semibold uppercase tracking-widest text-highlight">
              {title}
            </h2>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:bg-gunmetal-700 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
            aria-label={t('close')}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
