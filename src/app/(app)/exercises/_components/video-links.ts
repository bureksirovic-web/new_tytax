/**
 * Labelled video links of an exercise (G4-22): G1's i18n-free
 * `buildVideoLinks` from `@/lib/catalog`, with `kind` / `n` mapped to the
 * `ex_video_*` translation keys.
 */
import type { Exercise } from '@/contracts/domain';
import { buildVideoLinks, type VideoLink as CatalogVideoLink, type VideoLinkKind } from '@/lib/catalog';
import type { TranslationKey, TranslationVars } from '@/lib/i18n';

export interface VideoLink extends Pick<CatalogVideoLink, 'href' | 'kind'> {
  labelKey: TranslationKey;
  vars?: TranslationVars;
}

const LABEL_KEY: Record<VideoLinkKind, TranslationKey> = {
  tytax: 'ex_video_tytax',
  youtube: 'ex_video_youtube',
  other: 'ex_video_n',
  search: 'ex_video_search',
};

/** A catalog link with its label key; numbered kinds (youtube, other) carry `{ n }`. */
export function labelVideoLink(l: CatalogVideoLink): VideoLink {
  return {
    href: l.href,
    kind: l.kind,
    labelKey: LABEL_KEY[l.kind],
    ...((l.kind === 'youtube' || l.kind === 'other') && { vars: { n: l.n ?? 1 } }),
  };
}

/** app.tytax first, then YouTube, other links and a YouTube search last (order from `buildVideoLinks`). */
export function videoLinksFor(exercise: Pick<Exercise, 'name' | 'videos' | 'modality'>): VideoLink[] {
  return buildVideoLinks(exercise).map(labelVideoLink);
}
