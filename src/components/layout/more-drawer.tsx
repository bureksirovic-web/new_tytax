'use client';
import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/providers';
import { FOCUS_RING, MORE_ITEMS, isNavActive } from './nav-items';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function MoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus moves into the drawer on open, Tab is trapped inside, Escape closes,
  // and focus returns to whatever opened it once it closes.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl border-t border-line bg-card shadow-2xl md:max-w-lg md:rounded-xl md:border"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
          <h2 id={titleId} className="font-display text-sm font-semibold uppercase tracking-widest text-highlight">
            {t('nav_more')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className={`ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:bg-gunmetal-700 hover:text-fg ${FOCUS_RING}`}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav data-app-nav="more" aria-labelledby={titleId} className="flex-1 overflow-y-auto p-4 safe-bottom">
          <ul className="space-y-1">
            {MORE_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-14 w-full items-center gap-4 rounded-lg p-4 text-left transition-colors hover:bg-card-hover ${FOCUS_RING} ${
                      active ? 'bg-bg-2' : ''
                    }`}
                  >
                    <span className="w-8 shrink-0 text-center text-2xl text-fg-2" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="flex flex-col">
                      <span className={`font-display text-sm uppercase ${active ? 'text-highlight' : 'text-fg'}`}>
                        {t(item.label)}
                      </span>
                      {item.description && <span className="text-xs text-fg-muted">{t(item.description)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
