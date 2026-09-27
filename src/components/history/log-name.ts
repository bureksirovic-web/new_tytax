import type { WorkoutLog } from '@/contracts/domain';
import type { TranslationKey, TranslationVars } from '@/lib/i18n';
import '@/lib/i18n/packs/history';

type T = (key: TranslationKey, vars?: TranslationVars) => string;

/** Session name, or "Quick workout" when a program-less log has no name. */
export function logDisplayName(log: Pick<WorkoutLog, 'sessionName' | 'programId'>, t: T): string {
  const name = log.sessionName.trim();
  return name || t('hist_quick_workout');
}
