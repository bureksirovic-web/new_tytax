'use client';
import { installSyncAdapter } from '@/lib/sync/install';
import { AppBootstrap } from './app-bootstrap';
import { LocaleProvider } from './locale-provider';
import { SyncBootstrap } from './sync-bootstrap';
import { ThemeProvider } from './theme-provider';

/**
 * Inlined at build time (literal NEXT_PUBLIC_* reference): a build with sync
 * off folds this to `false`, so the sync wiring below is dead code there.
 */
const SYNC_BUILD = process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true';

// Before anything renders: with sync on, every repository write from the
// first one on queues its outbox op. Browser only (no-op on the server).
if (SYNC_BUILD) installSyncAdapter();

export { useLocale } from './locale-provider';
export { useTheme } from './theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppBootstrap />
        {SYNC_BUILD && <SyncBootstrap />}
        {children}
      </LocaleProvider>
    </ThemeProvider>
  );
}
