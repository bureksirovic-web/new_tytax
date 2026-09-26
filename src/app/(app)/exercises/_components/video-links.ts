/** Video link list for an exercise (pure). */
import type { Video } from '@/contracts/domain';
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
