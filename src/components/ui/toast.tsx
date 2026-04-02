'use client';
import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

const colors = {
  success: { bg: '#14532d', border: '#16a34a', icon: '✓' },
  error: { bg: '#450a0a', border: '#dc2626', icon: '✕' },
  info: { bg: '#1e3a5f', border: '#3b82f6', icon: 'ℹ' },
};

function ToastItem({ id, message, type }: { id: string; message: string; type: 'success' | 'error' | 'info' }) {
  const removeToast = useUIStore((s) => s.removeToast);

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), 3500);
    return () => clearTimeout(t);
  }, [id, removeToast]);

  const c = colors[type];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm text-white min-w-[260px] max-w-[360px]"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
      role="alert"
    >
      <span className="text-base flex-shrink-0">{c.icon}</span>
      <span className="flex-1">{message}</span>
      <button onClick={() => removeToast(id)} className="opacity-60 hover:opacity-100 text-xs flex-shrink-0" aria-label="Dismiss">✕</button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  );
}
