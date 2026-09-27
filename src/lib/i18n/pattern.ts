/**
 * Movement-pattern labels. Catalog patterns are free text written in several
 * styles ('Horizontal Push', 'horizontal-push', 'Hinge/RDL'); they are
 * normalised to one `pat_` key. A pattern with no key (custom exercises) is
 * shown exactly as the user wrote it.
 */
import { patternsHr } from './modules/patterns.hr';
import { patterns2Hr } from './modules/patterns2.hr';
import type { Locale, TranslationKey } from './types';
import { t } from '.';
import '@/lib/i18n/packs/patterns';
import '@/lib/i18n/packs/patterns2';

// Keys of the hr modules: tsc keeps them equal to the en keys.
const KEYS: ReadonlySet<string> = new Set([...Object.keys(patternsHr), ...Object.keys(patterns2Hr)]);

const slug = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function patternKey(raw: string | null | undefined): TranslationKey | undefined {
  if (!raw) return undefined;
  const key = `pat_${slug(raw)}`;
  return KEYS.has(key) ? (key as TranslationKey) : undefined;
}

/** Localised pattern for `locale`; the raw text when the pattern is unknown. */
export function patternLabel(raw: string, locale: Locale): string {
  const key = patternKey(raw);
  return key ? t(key, locale) : raw;
}
