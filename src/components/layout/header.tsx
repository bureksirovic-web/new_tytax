'use client';
import Link from 'next/link';
import { useUIStore } from '@/stores/ui-store';

interface HeaderProps {
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export function Header({ title, backHref, actions }: HeaderProps) {
  const focusMode = useUIStore((s) => s.focusMode);
  if (focusMode) return null;

  return (
    <header
      className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-10"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
    >
      {backHref && (
        <Link
          href={backHref}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gunmetal-800 transition-colors flex-shrink-0"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Go back"
        >
          ←
        </Link>
      )}
      <h1
        className="flex-1 text-base font-semibold uppercase tracking-widest truncate"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}
