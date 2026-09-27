'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/providers';
import { FOCUS_RING, NAV_SECTIONS, isNavActive } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-dvh shrink-0 border-r border-line bg-bg">
      <div className="px-4 py-5 border-b border-line">
        <span className="font-display text-xl font-bold uppercase tracking-[0.2em] text-highlight">
          {t('layout_app_name')}
        </span>
        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-fg-muted">
          {t('layout_tagline')}
        </div>
      </div>
      <nav data-app-nav="sidebar" className="flex-1 overflow-y-auto py-3" aria-label={t('layout_main_nav')}>
        {NAV_SECTIONS.map((section) => {
          const headingId = `sidebar-section-${section.label}`;
          return (
            <div key={section.label} className="mb-4">
              <div
                id={headingId}
                className="px-4 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-fg-muted"
              >
                {t(section.label)}
              </div>
              <ul aria-labelledby={headingId}>
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gunmetal-800 ${FOCUS_RING} focus-visible:-outline-offset-2 ${
                          active ? 'bg-bg-2 font-display text-highlight' : 'text-fg-2'
                        }`}
                      >
                        <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span>{t(item.label)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
