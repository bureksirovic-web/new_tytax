'use client';
import Link from 'next/link';
import { useUIStore } from '@/stores/ui-store';
import { useLocale } from '@/components/providers';
import { FOCUS_RING } from './nav-items';

interface HeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export function Header({ title, backHref, actions }: HeaderProps) {
  const { t } = useLocale();
  const focusMode = useUIStore((s) => s.focusMode);
  if (focusMode) return null;

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg px-4 py-2">
      {backHref && (
        <Link
          href={backHref}
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-gunmetal-800 hover:text-fg ${FOCUS_RING}`}
          aria-label={t('go_back')}
        >
          <span aria-hidden="true">←</span>
        </Link>
      )}
      <h1 className="flex-1 truncate font-display text-base font-semibold uppercase tracking-widest text-fg">
        {title}
      </h1>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
