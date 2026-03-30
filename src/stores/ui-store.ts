import { create } from 'zustand';

interface UIStore {
  focusMode: boolean;
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;

  toggleFocusMode: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  focusMode: false,
  sidebarOpen: false,
  activeModal: null,
  toasts: [],

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (message, type = 'info') => set((s) => ({
    toasts: [
      ...s.toasts,
      { id: crypto.randomUUID(), message, type },
    ],
  })),
  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  })),
}));
