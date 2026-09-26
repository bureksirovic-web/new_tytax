/**
 * Video links of an exercise (request G4-22). Pure and i18n-free: callers
 * turn `kind` + `n` into a label and render with
 * `target="_blank" rel="noopener noreferrer"`.
 */
import type { Exercise } from '@/contracts/domain';

export type VideoLinkKind = 'tytax' | 'youtube' | 'other' | 'search';

export interface VideoLink {
  href: string;
  kind: VideoLinkKind;
  /** 1-based number among links of the same kind; set for 'youtube' and 'other' only. */
  n?: number;
}

function parseHttp(url: string): URL | undefined {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : undefined;
  } catch {
    return undefined;
  }
}

const isHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

function kindOf(host: string): Exclude<VideoLinkKind, 'search'> {
  if (isHost(host, 'tytax.com')) return 'tytax';
  if (isHost(host, 'youtube.com') || isHost(host, 'youtube-nocookie.com') || host === 'youtu.be') return 'youtube';
  return 'other';
}

/** Leading "TYTAX T1 |", "TYTAX® T1-X-2 |", "Instruction |" style labels. */
const PREFIX = /^\s*(?:TYTAX(?:Â®|®)?(?:\s*T\d(?:-[A-Z])?(?:-\d+)?)?|Instruction)\s*\|\s*/i;

/** The exercise name as a search query: prefixes and parentheticals removed, whitespace collapsed. */
function searchName(name: string): string {
  let bare = name;
  while (PREFIX.test(bare)) bare = bare.replace(PREFIX, '');
  let s = bare;
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, ' ');
  // An unclosed "(…" tail (two catalog names end that way) is a parenthetical too.
  s = s.replace(/\([^()]*$/, ' ').replace(/[()]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // Everything was parenthetical: keep its words, still without the prefix or brackets.
  return s || bare.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** YouTube search URL for an exercise; TYTAX exercises get " TYTAX" appended unless the name already says it. */
function searchHref(exercise: Pick<Exercise, 'name' | 'modality'>): string {
  let q = searchName(exercise.name);
  if (exercise.modality === 'tytax' && !/\btytax\b/i.test(q)) q = `${q} TYTAX`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/**
 * app.tytax links first, then YouTube in catalog order, then other http(s)
 * links; non-http(s) or malformed urls and duplicates (same normalised URL)
 * are dropped. A YouTube search for the clean name always comes last.
 */
export function buildVideoLinks(exercise: Pick<Exercise, 'name' | 'videos' | 'modality'>): VideoLink[] {
  const seen = new Set<string>();
  const byKind: Record<'tytax' | 'youtube' | 'other', string[]> = { tytax: [], youtube: [], other: [] };
  for (const v of exercise.videos ?? []) {
    const u = parseHttp(v.url);
    if (!u || seen.has(u.href)) continue;
    seen.add(u.href);
    byKind[kindOf(u.hostname.toLowerCase())].push(u.href);
  }
  return [
    ...byKind.tytax.map((href): VideoLink => ({ href, kind: 'tytax' })),
    ...byKind.youtube.map((href, i): VideoLink => ({ href, kind: 'youtube', n: i + 1 })),
    ...byKind.other.map((href, i): VideoLink => ({ href, kind: 'other', n: i + 1 })),
    { href: searchHref(exercise), kind: 'search' },
  ];
}

/** The link a single "video" button opens: the first of `buildVideoLinks` (the search when there are no videos). */
export function primaryVideoLink(exercise: Pick<Exercise, 'name' | 'videos' | 'modality'>): VideoLink {
  return buildVideoLinks(exercise)[0];
}
