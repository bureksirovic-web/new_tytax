'use client';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useLocale } from '@/components/providers';
import type { TranslationKey } from '@/lib/i18n';

const MORE_ITEMS: Array<{ href: string; label: TranslationKey; icon: string; description: TranslationKey }> = [
  { href: '/history', label: 'workout_history', icon: '📋', description: 'past_sessions' },
  { href: '/programs', label: 'nav_programs', icon: '📅', description: 'training_plans' },
  { href: '/settings', label: 'nav_settings', icon: '⚙', description: 'preferences_sync' },
  { href: '/auth/login', label: 'sign_in', icon: '🔐', description: 'sync_across_devices' },
];

export function MoreDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('nav_more')}>
      <nav className="space-y-1 pb-safe">
        {MORE_ITEMS.map(item => (
          <button
            key={item.href}
            onClick={() => { onClose(); router.push(item.href); }}
            className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-[var(--bg-card)] transition-colors text-left min-h-[56px]"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <div className="font-['Oswald'] text-sm uppercase text-[var(--text-primary)]">{t(item.label)}</div>
              <div className="text-xs text-[var(--text-muted)]">{t(item.description)}</div>
            </div>
          </button>
        ))}
      </nav>
    </BottomSheet>
  );
}
