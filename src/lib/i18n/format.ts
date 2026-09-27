import type { Locale } from './types';

export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.20462;

/** Stored weights are always kg; convert for display. Rounded to 0.1. */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(value * 10) / 10;
}

/** Convert a user-entered value in `unit` back to kg for storage. Rounded to 0.01. */
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

const BCP47: Record<Locale, string> = { hr: 'hr-HR', en: 'en-GB' };

export function formatWeight(kg: number, unit: WeightUnit, locale: Locale): string {
  const n = toDisplayWeight(kg, unit);
  return `${new Intl.NumberFormat(BCP47[locale], { maximumFractionDigits: 1 }).format(n)} ${unit}`;
}

export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(BCP47[locale], options).format(d);
}
