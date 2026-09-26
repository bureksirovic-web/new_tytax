'use client';
/**
 * Sticky rest-timer bar for the active workout page (G3).
 *
 * Driven by the persisted rest-timer store through `useTimer()`, so it
 * survives reloads and stays correct after backgrounding. Rendered only while
 * a rest is running. On completion it fires the rest alerts once: vibration
 * [200,100,200], a beep, and a spoken "rest complete" when `voiceCues` is on.
 * Space stops the timer unless focus is in a form control or on a button.
 *
 * testids: rest-timer, rest-timer-remaining (m:ss), rest-timer-add30,
 * rest-timer-stop, rest-timer-progress (role=progressbar, aria-valuenow 0..100).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocale } from '@/components/providers';
import type { RestAlerts } from '@/components/workout/runtime/rest-alerts';
import { restAlerts } from '@/components/workout/set-rules';
import { useTimerStrings, voiceLang } from '@/components/workout/strings/timer';
import { useTimer } from '@/hooks/use-timer';
import { formatRest } from '@/stores/rest-timer-store';

export interface RestTimerBarProps {
  /** Profile setting: speak "rest complete" on completion. */
  voiceCues: boolean;
  /** Injectable alerts (tests); defaults to the browser implementation. */
  alerts?: RestAlerts;
  /** Injectable clock (tests). */
  now?: () => number;
}

/** 0..1 → integer percent clamped to 0..100. */
export function progressPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}

const SPACE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY', 'AUDIO', 'VIDEO']);
const SPACE_ROLES = new Set([
  'textbox', 'searchbox', 'button', 'combobox', 'link', 'checkbox', 'switch', 'radio',
  'tab', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'slider', 'spinbutton', 'treeitem',
]);

/** True when a Space press on `target` belongs to that element (controls, links, widgets), not to the timer. */
export function spaceBelongsToTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  if (SPACE_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
  return SPACE_ROLES.has(el.getAttribute('role') ?? '');
}

export function RestTimerBar({ voiceCues, alerts: alertsProp, now }: RestTimerBarProps) {
  const t = useTimerStrings();
  const { locale } = useLocale();
  // One app-wide AudioContext (iOS caps live contexts): share set-rules' singleton.
  const alerts = useMemo(() => alertsProp ?? restAlerts(), [alertsProp]);

  const voiceRef = useRef<{ text: string; lang: string } | null>(null);
  useEffect(() => {
    voiceRef.current = voiceCues ? { text: t('rest_timer_complete'), lang: voiceLang(locale) } : null;
  });

  const onComplete = useCallback(() => {
    alerts.fire({ vibrate: true, sound: true, voice: voiceRef.current });
  }, [alerts]);

  const { running, remaining, progress, add, stop } = useTimer({ onComplete, now });

  // Audio needs a user gesture on iOS: unlock on the first pointer/key press.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      alerts.unlock();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [alerts]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (spaceBelongsToTarget(e.target)) return;
      e.preventDefault();
      stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, stop]);

  if (!running) return null;

  const time = formatRest(remaining);
  const pct = progressPercent(progress);

  return (
    <section
      data-testid="rest-timer"
      aria-label={t('rest_timer_label')}
      className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 pb-2 pt-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('rest_timer_label')}</p>
          <p
            data-testid="rest-timer-remaining"
            role="timer"
            aria-label={t('rest_timer_remaining_label', { time })}
            className="font-mono text-3xl font-bold tabular-nums text-[var(--highlight)]"
          >
            {time}
          </p>
        </div>
        <button
          type="button"
          data-testid="rest-timer-add30"
          aria-label={t('rest_timer_add30_label')}
          onClick={() => add(30)}
          className="min-h-11 min-w-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        >
          {t('rest_timer_add30')}
        </button>
        <button
          type="button"
          data-testid="rest-timer-stop"
          aria-label={t('rest_timer_stop_label')}
          onClick={stop}
          className="min-h-11 min-w-11 rounded-lg border border-[var(--border-color)] px-3 text-sm uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        >
          {t('rest_timer_stop')}
        </button>
      </div>
      <div
        data-testid="rest-timer-progress"
        role="progressbar"
        aria-label={t('rest_timer_progress_label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card)]"
      >
        <svg className="block h-full w-full" aria-hidden="true" preserveAspectRatio="none">
          <rect width={`${pct}%`} height="100%" className="fill-[var(--highlight)]" />
        </svg>
      </div>
    </section>
  );
}
