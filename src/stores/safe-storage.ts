import type { StateStorage } from 'zustand/middleware';

/**
 * Storage for zustand `persist` that never throws (request G5-10).
 *
 * When the `window.localStorage` getter throws (`SecurityError`: Safari private
 * mode, blocked site data, some embedded webviews), `createJSONStorage(() =>
 * localStorage)` gives `undefined`, zustand then builds the store without its
 * `persist` API, and every `useX.persist.*` call crashes the route. Here the
 * store falls back to memory for the page's lifetime instead: the draft works,
 * it just does not survive a reload (nothing can, with storage blocked).
 */
export function safeLocalStorage(): StateStorage {
  try {
    const storage = window.localStorage;
    storage.getItem('tytax.storage-probe');
    return storage;
  } catch {
    return memoryStorage();
  }
}

function memoryStorage(): StateStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}
