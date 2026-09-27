'use client';
import { useSyncExternalStore } from 'react';
import { useLocale } from '@/components/providers';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getOnline = () => navigator.onLine;
// The server (and the hydration pass) always assumes online, so the markup matches.
const getServerOnline = () => true;

export function OfflineIndicator() {
  const { t } = useLocale();
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline);

  // The live region stays mounted so screen readers announce the change.
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        online
          ? 'sr-only'
          : 'fixed top-0 left-0 right-0 z-50 bg-highlight py-1 text-center text-xs font-bold text-gunmetal-950'
      }
    >
      {!online && `${t('offline')} — ${t('offline_data_saved')}`}
    </div>
  );
}
