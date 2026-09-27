import type { AuthKey } from '@/lib/auth/i18n';
import '@/lib/i18n/packs/g5Auth';

/** Localised date + time of a sync, or null when there was none (or it is unparsable). */
export function formatSyncedAt(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'hr' ? 'hr-HR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** i18n key for an adapter `lastError` code; the raw code is shown next to it as data. */
export function syncErrorKey(code: string): AuthKey {
  if (code === 'auth_required') return 'sync.error.auth_required';
  if (code === 'network') return 'sync.error.network';
  if (code === 'other_account') return 'sync.error.other_account';
  if (code === 'invalid_row') return 'sync.error.invalid_row';
  return 'sync.error.generic';
}
