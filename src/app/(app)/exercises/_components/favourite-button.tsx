'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';

const STAR_ON = '★';
const STAR_OFF = '☆';

interface FavouriteButtonProps {
  exerciseId: string;
  name: string;
  active: boolean;
  /** Disabled until the Arsenal and the active profile are known. */
  disabled?: boolean;
  onToggle: (exerciseId: string) => Promise<boolean>;
  className?: string;
}

/** Star toggle for the Arsenal (favourites). */
export function FavouriteButton({ exerciseId, name, active, disabled, onToggle, className = '' }: FavouriteButtonProps) {
  const { t } = useT();
  const addToast = useUIStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const nowFavourite = await onToggle(exerciseId);
      addToast(t(nowFavourite ? 'ex_favourite_added' : 'ex_favourite_removed'), 'success');
    } catch {
      addToast(t('ex_favourite_error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="exercise-favourite"
      aria-pressed={active}
      aria-label={t(active ? 'ex_favourite_remove' : 'ex_favourite_add', { name })}
      disabled={disabled || busy}
      onClick={() => void toggle()}
      className={`flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400
        disabled:cursor-not-allowed disabled:opacity-50
        ${active ? 'text-highlight' : 'text-fg-muted hover:text-fg'} ${className}`}
    >
      <span aria-hidden="true">{active ? STAR_ON : STAR_OFF}</span>
    </button>
  );
}
