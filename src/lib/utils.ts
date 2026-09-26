import type { ClassValue } from 'clsx';
import type { Units } from '@/contracts/domain';

export { localDay } from '@/contracts/fixtures';

/** Kilograms per pound factor used for display: 1 kg = 2.20462 lb. */
export const LB_PER_KG = 2.20462;

/** Stored kg → display value in `units` (lb rounded to 0.1; kg passes through). */
export function kgToDisplay(kg: number, units: Units): number {
  if (units === 'lb') return Math.round(kg * LB_PER_KG * 10) / 10;
  return kg;
}

/** Entered value in `units` → kg to store (lb ÷ 2.20462, unrounded; kg passes through). */
export function displayToKg(value: number, units: Units): number {
  if (units === 'lb') return value / LB_PER_KG;
  return value;
}

/** 'YYYY-MM-DD' → local midnight of that calendar day (not UTC). Invalid → Invalid Date. */
export function parseLocalDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return new Date(Number.NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function cn(...inputs: ClassValue[]) {
  // Simple class merger without tailwind-merge dependency
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ');
}

/**
 * uuid v4. `crypto.randomUUID` only exists in secure contexts (https or
 * localhost), so plain-http LAN testing on a phone falls back to
 * `getRandomValues` (available everywhere) — never throws.
 */
export function generateId(): string {
  const c: Crypto | undefined = typeof globalThis.crypto === 'object' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatWeight(kg: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') {
    return `${Math.round(kg * 2.20462 * 4) / 4} lb`;
  }
  return `${kg} kg`;
}

export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** @deprecated UTC calendar day. Contract `date` fields are the LOCAL day: use `localDay`. */
export function isoDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
