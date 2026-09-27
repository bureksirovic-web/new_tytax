'use client';
import { useState } from 'react';
import { StationsIcon } from './icons';
import { useSetupStrings } from './strings/setup';
import '@/lib/i18n/packs/g3Session';

export interface OrderByStationButtonProps {
  /** Exercises in the draft; the button is disabled below 2. */
  count: number;
  /** `useWorkout().orderByStation`: true when the order changed. */
  onOrder: () => Promise<boolean>;
}

type Outcome = 'done' | 'same' | 'error' | null;

/**
 * "Order by station" on the active workout (G3 item 4): reorders the draft so
 * the TYTAX T1 is re-rigged as rarely as possible (Smith → upper pulley →
 * lower pulley → leg ext/curl → frame; supersets stay together). The result
 * is announced in a polite status line under the button.
 */
export function OrderByStationButton({ count, onOrder }: OrderByStationButtonProps) {
  const t = useSetupStrings();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function order() {
    setBusy(true);
    try {
      setOutcome((await onOrder()) ? 'done' : 'same');
    } catch {
      setOutcome('error');
    } finally {
      setBusy(false);
    }
  }

  const message =
    outcome === 'done' ? t('order_station_done') : outcome === 'same' ? t('order_station_same') : outcome === 'error' ? t('order_station_error') : '';

  return (
    <div>
      <button
        type="button"
        data-testid="order-by-station"
        disabled={count < 2 || busy}
        aria-busy={busy}
        onClick={() => void order()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-3 text-sm uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <StationsIcon className="h-4 w-4" />
        {t('order_station')}
      </button>
      <p data-testid="order-by-station-status" role="status" className="mt-1 text-center text-xs text-[var(--text-muted)]">
        {message}
      </p>
    </div>
  );
}
