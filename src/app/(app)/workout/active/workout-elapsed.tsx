'use client';
import { useEffect, useState } from 'react';
import { useTimerStrings } from '@/components/workout/strings/timer';

/** Whole seconds between an ISO start and `now`; 0 for bad/future input. */
export function elapsedSeconds(startedAt: string, now: number): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** Seconds → "m:ss", or "h:mm:ss" from one hour. */
export function formatElapsed(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Live workout duration since `startedAt`, ticking once a second. testid: workout-elapsed. */
export function WorkoutElapsed({ startedAt, now = Date.now }: { startedAt: string; now?: () => number }) {
  const t = useTimerStrings();
  const [clock, setClock] = useState(() => now());
  useEffect(() => {
    const tick = () => setClock(now());
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [now]);

  const text = formatElapsed(elapsedSeconds(startedAt, clock));
  return (
    <p className="text-sm text-[var(--text-muted)]">
      <span className="sr-only">{t('workout_elapsed_label')}</span>
      <time data-testid="workout-elapsed" className="font-mono tabular-nums text-[var(--text-secondary)]">
        {text}
      </time>
    </p>
  );
}
