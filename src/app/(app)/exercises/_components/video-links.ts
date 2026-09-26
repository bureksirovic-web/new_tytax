/** Video link list for an exercise (pure). */
import type { Exercise, Video } from '@/contracts/domain';
import * as catalogModule from '@/lib/catalog';
import type { TranslationKey, TranslationVars } from '@/lib/i18n';

export interface VideoLink {
  href: string;
  labelKey: TranslationKey;
  vars?: TranslationVars;
  kind: 'tytax' | 'youtube' | 'other' | 'search';
}

function hostOf(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

const isHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Catalog order is kept (app.tytax first). YouTube links are numbered among
 * themselves; non-http(s) urls are dropped. A YouTube search for the name is
 * always appended.
 */
export function buildVideoLinks(videos: readonly Video[] | undefined, name: string): VideoLink[] {
  const out: VideoLink[] = [];
  let yt = 0;
  let other = 0;
  for (const v of videos ?? []) {
    const host = hostOf(v.url);
    if (!host) continue;
    if (isHost(host, 'tytax.com')) out.push({ href: v.url, labelKey: 'ex_video_tytax', kind: 'tytax' });
    else if (isHost(host, 'youtube.com') || host === 'youtu.be')
      out.push({ href: v.url, labelKey: 'ex_video_youtube', vars: { n: ++yt }, kind: 'youtube' });
    else out.push({ href: v.url, labelKey: 'ex_video_n', vars: { n: ++other }, kind: 'other' });
  }
  out.push({
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`,
    labelKey: 'ex_video_search',
    kind: 'search',
  });
  return out;
}

/** G1's link shape (`@/lib/catalog` `buildVideoLinks`, request G4-22): i18n-free. */
interface G1VideoLink {
  href: string;
  kind: VideoLink['kind'];
  n?: number;
}

const LABEL_KEY: Record<VideoLink['kind'], TranslationKey> = {
  tytax: 'ex_video_tytax',
  youtube: 'ex_video_youtube',
  other: 'ex_video_n',
  search: 'ex_video_search',
};

function isG1Link(l: unknown): l is G1VideoLink {
  const v = l as G1VideoLink | null;
  return typeof v?.href === 'string' && typeof v.kind === 'string' && v.kind in LABEL_KEY;
}

/**
 * Video links of an exercise: G1's shared `buildVideoLinks(exercise)` from
 * `@/lib/catalog` when that module exports it (G4-22), labelled with the
 * `ex_video_*` keys; otherwise the local `buildVideoLinks` above.
 */
export function videoLinksFor(
  exercise: Pick<Exercise, 'name' | 'videos' | 'modality'>,
  mod: unknown = catalogModule,
): VideoLink[] {
  const fn = (mod as Record<string, unknown> | undefined)?.buildVideoLinks;
  if (typeof fn === 'function') {
    const links: unknown = (fn as (e: typeof exercise) => unknown)(exercise);
    if (Array.isArray(links) && links.every(isG1Link)) {
      return links.map((l) => ({
        href: l.href,
        kind: l.kind,
        labelKey: LABEL_KEY[l.kind],
        ...((l.kind === 'youtube' || l.kind === 'other') && { vars: { n: l.n ?? 1 } }),
      }));
    }
  }
  return buildVideoLinks(exercise.videos, exercise.name);
}
