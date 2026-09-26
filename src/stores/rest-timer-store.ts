/**
 * Persisted rest timer (TYTAX v2, G3).
 *
 * Holds the serializable `RestTimerState` of
 * `src/components/workout/runtime/rest-timer.ts` ({ endsAt, totalS }) so a
 * running rest survives a reload. Persisted to localStorage under
 * `tytax.rest-timer.v1`; hydration is manual (`skipHydration`) like the
 * workout store: call `useRestTimerHydrated()` before trusting `timer`.
 *
 * API
 * - `useRestTimerStore` state `{ timer: RestTimerState | null }`, actions:
 *   `start(durationS, now?)`, `add(seconds = 30, now?)` (restarts from `now`
 *   when the rest already ended), `stop()`. `now` defaults to `Date.now()`.
 * - Pure selectors over a state and a clock value: `restRemaining(timer, now)`
 *   (whole seconds), `restProgress(timer, now)` (0..1), `restRunning(timer, now)`,
 *   `formatRest(seconds)` → "m:ss".
 * - `useRestTimerHydrated(): boolean`.
 *
 * Wiring with `useRestTimer` (runtime/use-rest-timer.ts): pass
 * `initialState: useRestTimerStore.getState().timer` after hydration and
 * `onStateChange: (s) => useRestTimerStore.setState({ timer: s })`.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  addSeconds,
  isDone,
  parseRestTimerState,
  progress,
  remaining,
  start as startTimer,
  type RestTimerState,
} from '@/components/workout/runtime/rest-timer';

export const REST_TIMER_STORAGE_KEY = 'tytax.rest-timer.v1';
export const REST_TIMER_VERSION = 1;
export const REST_ADD_DEFAULT_S = 30;

export interface RestTimerStoreState {
  timer: RestTimerState | null;
}

export interface RestTimerStoreActions {
  start(durationS: number, now?: number): void;
  add(seconds?: number, now?: number): void;
  stop(): void;
}

export type RestTimerStore = RestTimerStoreState & RestTimerStoreActions;

function timerFromPersisted(persisted: unknown): RestTimerState | null {
  if (typeof persisted !== 'object' || persisted === null) return null;
  return parseRestTimerState((persisted as Record<string, unknown>).timer);
}

export const useRestTimerStore = create<RestTimerStore>()(
  persist(
    (set) => ({
      timer: null,
      start: (durationS, now = Date.now()) => set({ timer: startTimer(now, durationS) }),
      add: (seconds = REST_ADD_DEFAULT_S, now = Date.now()) =>
        set((s) => (s.timer ? { timer: addSeconds(s.timer, seconds, now) } : s)),
      stop: () => set({ timer: null }),
    }),
    {
      name: REST_TIMER_STORAGE_KEY,
      version: REST_TIMER_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ timer: s.timer }),
      migrate: (persisted) => ({ timer: timerFromPersisted(persisted) }),
      merge: (persisted, current) => ({ ...current, timer: timerFromPersisted(persisted) }),
    },
  ),
);

// ─── Selectors ───────────────────────────────────────────────────────────────

export function restRemaining(timer: RestTimerState | null, now: number): number {
  return timer ? remaining(timer, now) : 0;
}

export function restProgress(timer: RestTimerState | null, now: number): number {
  return timer ? progress(timer, now) : 0;
}

export function restRunning(timer: RestTimerState | null, now: number): boolean {
  return timer !== null && !isDone(timer, now);
}

/** Seconds → "m:ss" (negative → "0:00"). */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Hydration ───────────────────────────────────────────────────────────────

function subscribeHydration(onChange: () => void): () => void {
  const offStart = useRestTimerStore.persist.onHydrate(onChange);
  const offFinish = useRestTimerStore.persist.onFinishHydration(onChange);
  return () => {
    offStart();
    offFinish();
  };
}

const getHydrated = (): boolean => useRestTimerStore.persist.hasHydrated();
const getServerHydrated = (): boolean => false;

/** Rehydrates the persisted timer once on mount; true once it has been read. */
export function useRestTimerHydrated(): boolean {
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
  useEffect(() => {
    if (!useRestTimerStore.persist.hasHydrated()) void useRestTimerStore.persist.rehydrate();
  }, []);
  return hydrated;
}
