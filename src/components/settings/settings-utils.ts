import type { Profile, ThemeName } from '@/contracts/domain';
import { useUIStore } from '@/stores/ui-store';

/** The theme provider calls the default (tactical) theme 'dark'. */
export type ProviderTheme = 'dark' | 'oled';
export const toProviderTheme = (theme: ThemeName): ProviderTheme => (theme === 'oled' ? 'oled' : 'dark');

export const PROFILE_NAME_MAX = 40;
export type NameProblem = 'required' | 'too_long' | 'taken';

/** Trimmed, 1–40 chars, unique case-insensitively among `profiles` (ignoring `selfId`). */
export function validateProfileName(raw: string, profiles: readonly Profile[], selfId?: string): NameProblem | null {
  const name = raw.trim();
  if (name === '') return 'required';
  if (name.length > PROFILE_NAME_MAX) return 'too_long';
  const lower = name.toLocaleLowerCase();
  if (profiles.some((p) => p.id !== selfId && p.name.trim().toLocaleLowerCase() === lower)) return 'taken';
  return null;
}

/** Active profile first, then oldest first (legacy insertion order). */
export function sortProfiles<T extends { profile: Profile }>(rows: readonly T[], activeId: string | undefined): T[] {
  return [...rows].sort((a, b) => {
    if (a.profile.id === activeId) return -1;
    if (b.profile.id === activeId) return 1;
    return a.profile.createdAt < b.profile.createdAt ? -1 : a.profile.createdAt > b.profile.createdAt ? 1 : 0;
  });
}

/** Seconds → "m:ss" (90 → "1:30"). */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const REST_MIN = 15;
export const REST_MAX = 600;
export const REST_STEP = 15;
export const clampRest = (s: number) => Math.min(REST_MAX, Math.max(REST_MIN, Math.round(s / REST_STEP) * REST_STEP));

/**
 * A user-entered non-negative decimal ("80", "80.5", "80,5").
 * Empty → null; anything else invalid → undefined.
 */
export function parseDecimal(input: string): number | null | undefined {
  const s = input.trim().replace(',', '.');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Local calendar day 'YYYY-MM-DD'. */
export function localDay(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function notify(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
  useUIStore.getState().addToast(message, type);
}

/** Triggers a browser download; the object URL is revoked after the click has been handled. */
export function downloadText(content: string, filename: string, mime: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
