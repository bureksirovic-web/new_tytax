'use client';
import { useEffect } from 'react';
import { useLocale } from '@/components/providers';
import { useUIStore } from '@/stores/ui-store';

const variants = {
  success: { cls: 'bg-green-900 border-green-600', icon: '✓' },
  error: { cls: 'bg-red-950 border-red-600', icon: '✕' },
  info: { cls: 'bg-blue-950 border-blue-500', icon: 'ℹ' },
};

function ToastItem({ id, message, type }: { id: string; message: string; type: 'success' | 'error' | 'info' }) {
  const { t } = useLocale();
  const removeToast = useUIStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(id), 3500);
    return () => clearTimeout(timer);
  }, [id, removeToast]);

  const v = variants[type];

  return (
    <div
      className={`flex min-w-[260px] max-w-[360px] items-center gap-3 rounded-lg border py-1 pl-4 pr-1 text-sm text-white shadow-lg ${v.cls}`}
      role="alert"
    >
      <span className="flex-shrink-0 text-base" aria-hidden="true">{v.icon}</span>
      <span className="flex-1 py-2">{message}</span>
      <button
        type="button"
        onClick={() => removeToast(id)}
        className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg text-xs text-gunmetal-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
        aria-label={t('dismiss')}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem {...toast} />
        </div>
      ))}
    </div>
  );
}
