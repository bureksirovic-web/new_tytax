import { describe, expect, it } from 'vitest';
import type { Exercise, Video } from '@/contracts/domain';
import { buildVideoLinks as fromIndex, primaryVideoLink as primaryFromIndex } from '../index';
import { buildVideoLinks, primaryVideoLink } from '../video-links';

type VideoExercise = Pick<Exercise, 'name' | 'videos' | 'modality'>;
const v = (url: string): Video => ({ url, label: url });
const SEARCH = 'https://www.youtube.com/results?search_query=';

describe('buildVideoLinks (G4-22)', () => {
  it('orders app.tytax, then YouTube, then other links, then the search; numbers YouTube and other from 1', () => {
    const exercise: VideoExercise = {
      name: 'Smith Bench Press',
      modality: 'tytax',
      videos: [
        v('https://www.youtube.com/watch?v=a'),
        v('https://vimeo.com/1'),
        v('https://app.tytax.com/en/x'),
        v('https://youtu.be/b'),
        v('http://example.org/clip'),
      ],
    };
    // youtube: watch?v=a → 1, youtu.be/b → 2 (catalog order); other: vimeo → 1, example.org → 2
    expect(buildVideoLinks(exercise).map((l) => [l.kind, l.n])).toEqual([
      ['tytax', undefined],
      ['youtube', 1],
      ['youtube', 2],
      ['other', 1],
      ['other', 2],
      ['search', undefined],
    ]);
    expect(buildVideoLinks(exercise).map((l) => l.href).slice(0, 5)).toEqual([
      'https://app.tytax.com/en/x',
      'https://www.youtube.com/watch?v=a',
      'https://youtu.be/b',
      'https://vimeo.com/1',
      'http://example.org/clip',
    ]);
  });

  it('drops javascript:, other non-http(s) and malformed urls, and duplicates', () => {
    const links = buildVideoLinks({
      name: 'X',
      modality: 'bodyweight',
      videos: [
        v('javascript:alert(1)'),
        v('JAVASCRIPT:alert(1)'),
        v('data:text/html,<b>x</b>'),
        v('ftp://files.example.org/a.mp4'),
        v('not a url'),
        v('https://www.youtube.com/watch?v=a'),
        v('https://WWW.YOUTUBE.COM/watch?v=a'),
        v('https://www.youtube.com/watch?v=a'),
      ],
    });
    // one YouTube link survives (the other two normalise to the same URL) + the search = 2
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ href: 'https://www.youtube.com/watch?v=a', kind: 'youtube', n: 1 });
    expect(links.some((l) => /^(javascript|data|ftp):/i.test(l.href))).toBe(false);
  });

  it('always ends with a YouTube search for the clean name, URI-encoded', () => {
    // "&" → %26, spaces → %20; TYTAX modality appends " TYTAX"
    expect(buildVideoLinks({ name: 'Smith Bench & Press', modality: 'tytax' }).at(-1)).toEqual({
      href: `${SEARCH}Smith%20Bench%20%26%20Press%20TYTAX`,
      kind: 'search',
    });
    // prefix "TYTAX T1 |" and the parenthetical go; č is UTF-8 encoded as %C4%8D
    expect(buildVideoLinks({ name: 'TYTAX T1 | Smith Spoto Press (pause on chest) čučanj', modality: 'tytax' }).at(-1)?.href).toBe(
      `${SEARCH}Smith%20Spoto%20Press%20%C4%8Du%C4%8Danj%20TYTAX`,
    );
    expect(buildVideoLinks({ name: 'TYTAX® T1-X-2 | Instruction | Leg Curl', modality: 'tytax' }).at(-1)?.href).toBe(`${SEARCH}Leg%20Curl%20TYTAX`);
    // a name that already says TYTAX is not suffixed twice
    expect(buildVideoLinks({ name: 'TYTAX Row', modality: 'tytax' }).at(-1)?.href).toBe(`${SEARCH}TYTAX%20Row`);
  });

  it('does not append " TYTAX" for bodyweight, kettlebell or custom exercises', () => {
    expect(buildVideoLinks({ name: 'Pull-up (wide grip)', modality: 'bodyweight' }).at(-1)?.href).toBe(`${SEARCH}Pull-up`);
    expect(buildVideoLinks({ name: 'Swing', modality: 'kettlebell' }).at(-1)?.href).toBe(`${SEARCH}Swing`);
    expect(buildVideoLinks({ name: 'My Move', modality: 'custom' }).at(-1)?.href).toBe(`${SEARCH}My%20Move`);
    // a name that is only a parenthetical falls back to the raw name
    expect(buildVideoLinks({ name: '(stretch)', modality: 'bodyweight' }).at(-1)?.href).toBe(`${SEARCH}(stretch)`);
  });

  it('primaryVideoLink is the first link, the search when there are no videos', () => {
    const withVideos: VideoExercise = { name: 'A', modality: 'tytax', videos: [v('https://youtu.be/b'), v('https://app.tytax.com/a')] };
    expect(primaryVideoLink(withVideos)).toEqual({ href: 'https://app.tytax.com/a', kind: 'tytax' });
    expect(primaryVideoLink({ name: 'Plank', modality: 'bodyweight' })).toEqual({ href: `${SEARCH}Plank`, kind: 'search' });
    expect(buildVideoLinks({ name: 'Plank', modality: 'bodyweight', videos: [] })).toHaveLength(1); // only the search
  });

  it('is re-exported from @/lib/catalog', () => {
    expect(fromIndex).toBe(buildVideoLinks);
    expect(primaryFromIndex).toBe(primaryVideoLink);
  });
});
