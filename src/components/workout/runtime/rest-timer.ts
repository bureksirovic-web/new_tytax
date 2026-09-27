/**
 * Pure, timestamp-based rest timer model.
 *
 * The state is a plain JSON-serializable object anchored to an absolute
 * `endsAt` epoch-ms timestamp, so it stays correct across background tab
 * throttling, device sleep and page reloads (persist it, hydrate it with
 * `parseRestTimerState`, then keep deriving from the wall clock).
 */

export interface RestTimerState {
  /** Epoch ms at which the rest period ends. */
  endsAt: number;
  /** Total length of the rest period in seconds (grows with `addSeconds`). */
  totalS: number;
}

const MS = 1000;

function safeSeconds(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Starts a rest period of `durationS` seconds at time `now` (epoch ms). */
export function start(now: number, durationS: number): RestTimerState {
  const totalS = safeSeconds(durationS);
  return { endsAt: now + totalS * MS, totalS };
}

/** Whole seconds left (rounded up), never negative. */
export function remaining(state: RestTimerState, now: number): number {
  const leftMs = state.endsAt - now;
  if (!(leftMs > 0)) return 0;
  return Math.ceil(leftMs / MS);
}

/** True once the rest period has elapsed. */
export function isDone(state: RestTimerState, now: number): boolean {
  return now >= state.endsAt;
}

/**
 * Extends the rest period by `seconds`. Both `endsAt` and `totalS` grow so the
 * progress fraction never exceeds 1. When `now` is given and the timer has
 * already finished, a fresh period of `seconds` is started from `now`.
 */
export function addSeconds(
  state: RestTimerState,
  seconds: number,
  now?: number,
): RestTimerState {
  const extra = safeSeconds(seconds);
  // Nothing to add: never restart (and re-fire) an already-finished rest.
  if (extra === 0) return state;
  if (now !== undefined && isDone(state, now)) return start(now, extra);
  return { endsAt: state.endsAt + extra * MS, totalS: state.totalS + extra };
}

/** Fraction of the rest period elapsed, clamped to 0..1. */
export function progress(state: RestTimerState, now: number): number {
  if (!(state.totalS > 0)) return 1;
  const elapsed = 1 - (state.endsAt - now) / (state.totalS * MS);
  if (!Number.isFinite(elapsed)) return 1;
  return Math.min(1, Math.max(0, elapsed));
}

/** Stopping a timer yields "no timer". Kept for API symmetry. */
export function stop(): null {
  return null;
}

/** Validates an unknown (e.g. JSON-parsed) value as a timer state. */
export function parseRestTimerState(value: unknown): RestTimerState | null {
  if (typeof value !== 'object' || value === null) return null;
  const { endsAt, totalS } = value as Record<string, unknown>;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return null;
  if (typeof totalS !== 'number' || !Number.isFinite(totalS) || totalS < 0) {
    return null;
  }
  return { endsAt, totalS };
}
