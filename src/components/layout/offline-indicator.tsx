'use client';
import { useState, useEffect } from 'react';
import { useLocale } from '@/components/providers';

export function OfflineIndicator() {
  const { t } = useLocale();
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--highlight)] text-black text-xs font-bold text-center py-1">
      {t('offline')} — {t('offline_data_saved')}
    </div>
  );
}
