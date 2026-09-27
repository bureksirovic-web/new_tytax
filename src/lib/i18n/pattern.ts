/**
 * Movement-pattern labels. Catalog patterns are free text written in several
 * styles ('Horizontal Push', 'horizontal-push', 'Hinge/RDL'); they are
 * normalised to one `pat_` key. A pattern with no key (custom exercises) is
 * shown exactly as the user wrote it.
 */
import { patternsEn } from './modules/patterns';
import { patterns2En } from './modules/patterns2';
import type { Locale, TranslationKey } from './types';
import { t } from '.';

const KEYS: ReadonlySet<string> = new Set([...Object.keys(patternsEn), ...Object.keys(patterns2En)]);

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
