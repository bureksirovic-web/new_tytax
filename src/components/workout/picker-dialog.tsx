'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useLocale } from '@/components/providers';
import { CloseIcon } from './icons';
import { useDialogFocus } from './use-dialog-focus';

export interface PickerDialogProps {
  title: string;
  testId: string;
  closeTestId: string;
  onClose: () => void;
  /** Fixed controls above the scrolling body (search, filters). */
  header?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}

/**
 * Bottom-sheet / centred modal shell shared by the exercise picker and the
 * swap sheet. Escape closes; focus is trapped inside and restored on close.
 */
export function PickerDialog({ title, testId, closeTestId, onClose, header, busy, children }: PickerDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-display text-lg font-bold uppercase tracking-wider text-[var(--highlight)]">
            {title}
          </h2>
          <button
            type="button"
            data-testid={closeTestId}
            aria-label={t('close')}
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
          >
            <CloseIcon />
          </button>
        </div>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={busy}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Centered status line inside a picker body (announced politely, unlike the option list). */
export function PickerStatus({ children }: { children: ReactNode }) {
  return <p role="status" className="py-6 text-center text-sm text-[var(--text-muted)]">{children}</p>;
}

export const PICKER_INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';
