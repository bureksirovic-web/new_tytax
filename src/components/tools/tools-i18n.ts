'use client';
import { useLocale } from '@/components/providers';
import { t as translate } from '@/lib/i18n';
import { TOOLS_STRINGS, type ToolsKey } from './tools-strings';

export { TOOLS_STRINGS, type ToolsKey };

/**
 * Tools strings from the shared dictionary (module g3Tools; request
 * G4-W2-01). TOOLS_STRINGS stays as the reviewed source the drift test checks.
 */
export function useToolsT(): (key: ToolsKey) => string {
  const { locale } = useLocale();
  return (key) => translate(key, locale);
}
