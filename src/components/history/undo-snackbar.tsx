'use client';
import { useEffect, useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { useHistoryUndo } from './undo-store';

/** "Workout deleted — Undo" bar; the undo window lasts UNDO_WINDOW_MS from the delete. */
export function UndoSnackbar() {
  const { t } = useT();
  const repo = useRepo();
  const pending = useHistoryUndo((s) => s.pending);
  const count = useHistoryUndo((s) => (s.pending ? s.earlier.length + 1 : 0));
  const undo = useHistoryUndo((s) => s.undo);
  const dismiss = useHistoryUndo((s) => s.dismiss);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const token = pending.token;
    // Remaining time, not a fresh window: the store outlives this component
    // (detail → list navigation, or leaving /history and coming back later).
    const remaining = Math.max(0, pending.expiresAt - Date.now());
    const timer = setTimeout(() => dismiss(token), remaining);
    return () => clearTimeout(timer);
  }, [pending, dismiss]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const onUndo = async () => {
    try {
      if (await undo(repo)) setMessage(t('hist_restored'));
    } catch {
      setMessage(t('hist_action_failed'));
    }
  };

  const deleted = count > 1 ? t('hist_deleted_n', { n: count }) : t('hist_deleted');
  const text = pending ? deleted : message;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6"
    >
      {text ? (
        <div
          data-testid="history-undo-bar"
          className="pointer-events-auto flex min-w-64 max-w-sm items-center gap-3 rounded-lg border border-line bg-card py-1 pl-4 pr-1 text-sm text-fg shadow-lg"
        >
          <span className="flex-1 py-2">{text}</span>
          {pending ? (
            <button
              type="button"
              onClick={onUndo}
              data-testid="history-undo"
              className="min-h-11 rounded-md px-4 font-display font-semibold uppercase tracking-wide text-highlight hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              {t('hist_undo')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
