'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/ui-store';
import { useLocale } from '@/components/providers';
import { MoreDrawer } from './more-drawer';
import { BOTTOM_NAV_ITEMS, FOCUS_RING, isMoreActive, isNavActive } from './nav-items';

const TAB_CLASS = `flex min-h-14 w-full flex-col items-center justify-center gap-0.5 py-2 transition-colors hover:text-fg ${FOCUS_RING} focus-visible:-outline-offset-2`;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();
  const focusMode = useUIStore((s) => s.focusMode);
  const [moreOpen, setMoreOpen] = useState(false);

  if (focusMode) return null;

  const moreActive = isMoreActive(pathname);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-bg safe-bottom md:hidden"
        aria-label={t('layout_main_nav')}
      >
        <ul className="flex items-stretch">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`${TAB_CLASS} ${active ? 'text-highlight' : 'text-fg-muted'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
                  <span className="font-display text-[10px] font-medium uppercase tracking-wide">
                    {t(item.label)}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`${TAB_CLASS} ${moreActive ? 'text-highlight' : 'text-fg-muted'}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              <span className="text-lg leading-none" aria-hidden="true">≡</span>
              <span className="font-display text-[10px] font-medium uppercase tracking-wide">
                {t('nav_more')}
              </span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
