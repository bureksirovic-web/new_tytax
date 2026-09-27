import type { en } from './en';

export type Locale = 'hr' | 'en';
export type TranslationKey = keyof typeof en;
export type TranslationVars = Record<string, string | number>;
