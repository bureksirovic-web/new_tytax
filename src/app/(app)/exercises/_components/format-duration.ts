import type { TranslationKey, TranslationVars } from '@/lib/i18n';
import { durationParts } from './history-stats';
import '@/lib/i18n/packs/exercises';

type T = (key: TranslationKey, vars?: TranslationVars) => string;

/** "45 s" under a minute, else "1:30 min" (templates in the ex_ module). */
export function formatDuration(t: T, seconds: number): string {
  const { m, s, ss } = durationParts(seconds);
  return m === 0 ? t('ex_duration_s', { s }) : t('ex_duration_ms', { m, ss });
}
