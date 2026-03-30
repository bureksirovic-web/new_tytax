'use client';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useUIStore } from '@/stores/ui-store';

const MORE_ITEMS = [
  { href: '/history', label: 'Workout History', icon: '📋', description: 'Past sessions' },
  { href: '/programs', label: 'Programs', icon: '📅', description: 'Training plans' },
  { href: '/settings', label: 'Settings', icon: '⚙', description: 'Preferences & sync' },
  { href: '/auth/login', label: 'Sign In', icon: '🔐', description: 'Sync across devices' },
];

export function MoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <BottomSheet open={open} onClose={onClose} title="MORE">
      <nav className="space-y-1 pb-safe">
        {MORE_ITEMS.map(item => (
          <button
            key={item.href}
            onClick={() => { onClose(); router.push(item.href); }}
            className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-[var(--bg-card)] transition-colors text-left min-h-[56px]"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <div className="font-['Oswald'] text-sm uppercase text-[var(--text-primary)]">{item.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{item.description}</div>
            </div>
          </button>
        ))}
      </nav>
    </BottomSheet>
  );
}
