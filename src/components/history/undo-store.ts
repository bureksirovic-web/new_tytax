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
  pending: PendingUndo | null;
  /** Soft-deletes the log and opens the undo window. */
  remove(repo: Repository, profileId: string, logId: string): Promise<void>;
  /** Restores the pending log; returns true when something was restored. */
  undo(repo: Repository): Promise<boolean>;
  dismiss(token?: number): void;
}

let counter = 0;

export const useHistoryUndo = create<UndoState>((set, get) => ({
  pending: null,
  async remove(repo, profileId, logId) {
    await repo.logs.softDelete(profileId, logId);
    counter += 1;
    set({ pending: { profileId, logId, token: counter, expiresAt: Date.now() + UNDO_WINDOW_MS } });
  },
  async undo(repo) {
    const pending = get().pending;
    if (!pending) return false;
    set({ pending: null });
    if (Date.now() > pending.expiresAt) return false;
    await repo.logs.restore(pending.profileId, pending.logId);
    return true;
  },
  dismiss(token) {
    const pending = get().pending;
    if (!pending || (token !== undefined && pending.token !== token)) return;
    set({ pending: null });
  },
}));
