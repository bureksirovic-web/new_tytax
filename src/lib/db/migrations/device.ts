/**
 * v2 device settings. The v2 app (69cea4e) never wrote units / language /
 * theme to a profile row: they lived in localStorage only
 * (settings page 'units' = 'metric' | 'imperial', locale-provider 'locale' =
 * 'en' | 'hr' defaulting to 'en', theme-provider 'theme' = 'dark' | 'oled').
 * This maps what that device showed to v3 settings values.
 */
import type { LegacyDeviceSettings } from './types';

/** The part of `Storage` the reader needs (injectable in tests). */
export interface ReadableStorage {
  getItem(key: string): string | null;
}

/**
 * What the v2 UI displayed on this device. Missing keys take the v2 UI
 * defaults (metric, English, dark), which is what the user saw, not the v3
 * contract defaults. Unreadable storage (blocked site data, private mode,
 * no DOM) yields `undefined`: the migration then uses contract defaults.
 */
export function readLegacyDeviceSettings(storage: ReadableStorage | undefined): LegacyDeviceSettings | undefined {
  if (storage === undefined) return undefined;
  try {
    const units = storage.getItem('units');
    const locale = storage.getItem('locale');
    const theme = storage.getItem('theme');
    return {
      units: units === 'imperial' ? 'lb' : 'kg',
      language: locale === 'hr' ? 'hr' : 'en',
      theme: theme === 'oled' ? 'oled' : 'tactical',
    };
  } catch {
    return undefined;
  }
}

/** `globalThis.localStorage`, or undefined when absent or when touching it throws. */
export function browserStorage(): ReadableStorage | undefined {
  try {
    const s: unknown = (globalThis as { localStorage?: unknown }).localStorage;
    return typeof s === 'object' && s !== null && typeof (s as ReadableStorage).getItem === 'function'
      ? (s as ReadableStorage)
      : undefined;
  } catch {
    return undefined;
  }
}
