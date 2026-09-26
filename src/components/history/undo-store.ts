'use client';
/**
 * Soft delete with undo for workout logs. Module-level (zustand) so the undo
 * snackbar survives the detail → list navigation after a delete.
 */
import { create } from 'zustand';
import type { Repository } from '@/contracts/repo';

/** How long the Undo action stays available. */
export const UNDO_WINDOW_MS = 6000;

export interface PendingUndo {
  profileId: string;
  logId: string;
  /** Changes on every delete so a new delete restarts the timer. */
  token: number;
  /** Epoch ms after which Undo is no longer offered (survives unmounts). */
  expiresAt: number;
}

interface UndoState {
  /** The most recent delete; Undo restores this one first. */
  pending: PendingUndo | null;
  /** Older deletes still inside their own window, oldest first (a stack under `pending`). */
  earlier: PendingUndo[];
  /** Soft-deletes the log and opens the undo window. */
  remove(repo: Repository, profileId: string, logId: string): Promise<void>;
  /** Restores the most recent pending log; the next one (if still in its window) becomes pending. */
  undo(repo: Repository): Promise<boolean>;
  dismiss(token?: number): void;
}

let counter = 0;

const alive = (entries: PendingUndo[], now: number) => entries.filter((e) => e.expiresAt >= now);

export const useHistoryUndo = create<UndoState>((set, get) => ({
  pending: null,
  earlier: [],
  async remove(repo, profileId, logId) {
    await repo.logs.softDelete(profileId, logId);
    counter += 1;
    const now = Date.now();
    const { pending, earlier } = get();
    set({
      pending: { profileId, logId, token: counter, expiresAt: now + UNDO_WINDOW_MS },
      earlier: alive(pending ? [...earlier, pending] : earlier, now),
    });
  },
  async undo(repo) {
    const { pending, earlier } = get();
    if (!pending) return false;
    const now = Date.now();
    const rest = alive(earlier, now);
    set({ pending: rest[rest.length - 1] ?? null, earlier: rest.slice(0, -1) });
    if (now > pending.expiresAt) return false;
    await repo.logs.restore(pending.profileId, pending.logId);
    return true;
  },
  dismiss(token) {
    const pending = get().pending;
    if (!pending || (token !== undefined && pending.token !== token)) return;
    // Older entries expire before the newest one, so nothing is left to undo.
    set({ pending: null, earlier: [] });
  },
}));
