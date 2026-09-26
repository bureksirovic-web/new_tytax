'use client';
import { useLocale } from '@/components/providers';
import { TOOLS_STRINGS, type ToolsKey } from './tools-strings';

export { TOOLS_STRINGS, type ToolsKey };

export function useToolsT(): (key: ToolsKey) => string {
  const { locale } = useLocale();
  const table = locale === 'hr' ? TOOLS_STRINGS.hr : TOOLS_STRINGS.en;
  return (key) => table[key];
}
