'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Training',
    items: [
      { href: '/dashboard', label: 'Command Center', icon: '⌂' },
      { href: '/workout', label: 'Training Center', icon: '◈' },
      { href: '/history', label: 'Vault', icon: '◫' },
    ],
  },
  {
    label: 'Intel',
    items: [
      { href: '/exercises', label: 'Meta-Library', icon: '⊞' },
      { href: '/exercises/arsenal', label: 'Arsenal', icon: '⋈' },
      { href: '/programs', label: 'Programs', icon: '▦' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/analytics', label: 'Force Analytics', icon: '▲' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/tools/plate-calculator', label: 'Plate Calculator', icon: '⚖' },
      { href: '/tools/rm-calculator', label: '1RM Calculator', icon: '⟨' },
      { href: '/settings', label: 'Settings', icon: '≡' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-56 border-r min-h-dvh flex-shrink-0"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <span
          className="text-xl font-bold tracking-[0.2em] uppercase"
          style={{ color: 'var(--highlight)', fontFamily: 'var(--font-display)' }}
        >
          TYTAX
        </span>
        <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Training Companion
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-4 py-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gunmetal-800"
                  style={{ color: active ? 'var(--highlight)' : 'var(--text-secondary)', backgroundColor: active ? 'var(--bg-secondary)' : undefined }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="text-base w-5 text-center flex-shrink-0" aria-hidden="true">{item.icon}</span>
                  <span style={{ fontFamily: active ? 'var(--font-display)' : undefined }}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
