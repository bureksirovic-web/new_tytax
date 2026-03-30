'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/ui-store';
import { MoreDrawer } from './more-drawer';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/workout', label: 'Workout', icon: '◈' },
  { href: '/exercises', label: 'Exercises', icon: '⊞' },
  { href: '/analytics', label: 'Analytics', icon: '▲' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const focusMode = useUIStore((s) => s.focusMode);
  const [moreOpen, setMoreOpen] = useState(false);

  if (focusMode) return null;

  const moreActive = ['/history', '/settings', '/programs'].some(path => pathname.startsWith(path));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t safe-bottom md:hidden"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] w-full transition-colors"
                style={{ color: active ? 'var(--highlight)' : 'var(--text-muted)' }}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] w-full transition-colors"
            style={{ color: moreActive ? 'var(--highlight)' : 'var(--text-muted)' }}
            aria-current={moreActive ? 'page' : undefined}
          >
            <span className="text-lg leading-none" aria-hidden="true">≡</span>
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              More
            </span>
          </button>
        </li>
      </ul>
      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </nav>
  );
}
