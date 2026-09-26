/**
 * Exercise video link resolution. Order: app.tytax.com, then YouTube, then
 * any other http(s) link. No usable link -> a YouTube search for the name.
 * `all` always contains `primary` (length 1 -> open directly, >1 -> menu).
 */

export type VideoKind = 'tytax' | 'youtube' | 'search' | 'other';

export interface VideoLink {
  url: string;
  label?: string;
  kind: VideoKind;
}

export interface VideoSource {
  name: string;
  videos?: { url: string; label?: string }[] | null;
}

export interface ResolvedVideo {
  primary: VideoLink;
  all: VideoLink[];
}

const YOUTUBE_SEARCH = 'https://www.youtube.com/results?search_query=';
const PREFIX_RE = /^\s*TYTAX(?:\s+[A-Z]*\d+)?\s*\|\s*/i;
const KIND_ORDER: Record<VideoKind, number> = { tytax: 0, youtube: 1, other: 2, search: 3 };

/** Strips a leading "TYTAX T1 |" style prefix from an exercise name. */
export function cleanExerciseName(name: string): string {
  const cleaned = name.replace(PREFIX_RE, '').trim();
  return cleaned || name.trim();
}

/** Parses a URL, accepting only http(s). Returns null for anything else. */
export function safeHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hostIs(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function classifyVideoUrl(url: URL): Exclude<VideoKind, 'search'> {
  const host = url.hostname.toLowerCase();
  if (hostIs(host, 'tytax.com')) return 'tytax';
  if (
    hostIs(host, 'youtube.com') ||
    hostIs(host, 'youtu.be') ||
    hostIs(host, 'youtube-nocookie.com')
  ) {
    return 'youtube';
  }
  return 'other';
}

export function youtubeSearchUrl(name: string): string {
  return YOUTUBE_SEARCH + encodeURIComponent(cleanExerciseName(name));
}

export function resolveVideo(ex: VideoSource): ResolvedVideo {
  const seen = new Set<string>();
  const links: (VideoLink & { index: number })[] = [];
  (ex.videos ?? []).forEach((video, index) => {
    const url = safeHttpUrl(video?.url);
    if (!url || seen.has(url.href)) return;
    seen.add(url.href);
    const label = video.label?.trim() || undefined;
    links.push({ url: url.href, label, kind: classifyVideoUrl(url), index });
  });
  links.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.index - b.index);
  const all: VideoLink[] = links.map(({ url, label, kind }) =>
    label === undefined ? { url, kind } : { url, label, kind },
  );
  if (all.length === 0) {
    const search: VideoLink = { url: youtubeSearchUrl(ex.name), kind: 'search' };
    return { primary: search, all: [search] };
  }
  return { primary: all[0], all };
}
