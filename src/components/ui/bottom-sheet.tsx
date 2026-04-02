'use client';
import { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: ('half' | 'full')[];
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as NodeListOf<HTMLElement>;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    sheet.addEventListener('keydown', handleTab);
    return () => sheet.removeEventListener('keydown', handleTab);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="relative w-full md:max-w-lg rounded-t-2xl md:rounded-xl border-t md:border shadow-2xl max-h-[90dvh] flex flex-col"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="w-10 h-1 bg-gunmetal-600 rounded-full md:hidden mx-auto absolute top-2 left-1/2 -translate-x-1/2" />
          {title ? (
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--highlight)', fontFamily: 'var(--font-display)' }}>
              {title}
            </h2>
          ) : <div />}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gunmetal-700 ml-auto"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">{children}</div>
      </div>
    </div>
  );
}
