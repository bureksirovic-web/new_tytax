import { describe, expect, it } from 'vitest';
import { cleanExerciseName, resolveVideo, safeHttpUrl, youtubeSearchUrl } from '@/components/workout/runtime/video-links';

describe('cleanExerciseName', () => {
  it('strips a leading TYTAX prefix', () => {
    expect(cleanExerciseName('TYTAX T1 | Bench Press')).toBe('Bench Press');
    expect(cleanExerciseName('tytax t2|Row')).toBe('Row');
    expect(cleanExerciseName('TYTAX | Squat')).toBe('Squat');
    expect(cleanExerciseName('  Čučanj  ')).toBe('Čučanj');
  });

  it('keeps names without the prefix, and never returns empty', () => {
    expect(cleanExerciseName('Cable Fly | Low')).toBe('Cable Fly | Low');
    expect(cleanExerciseName('TYTAX T1 | ')).toBe('TYTAX T1 |');
  });
});

describe('safeHttpUrl', () => {
  it('accepts http(s) only', () => {
    expect(safeHttpUrl('https://a.com/x')?.href).toBe('https://a.com/x');
    expect(safeHttpUrl('http://a.com')?.href).toBe('http://a.com/');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(' JavaScript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<b>')).toBeNull();
    expect(safeHttpUrl('ftp://a.com')).toBeNull();
    expect(safeHttpUrl('/relative')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
  });
});

describe('resolveVideo', () => {
  it('falls back to a YouTube search of the cleaned name', () => {
    const r = resolveVideo({ name: 'TYTAX T1 | Bench Press & Fly' });
    const url = 'https://www.youtube.com/results?search_query=Bench%20Press%20%26%20Fly';
    expect(r.primary).toEqual({ url, kind: 'search' });
    expect(r.all).toEqual([r.primary]);
    expect(youtubeSearchUrl('Čučanj')).toBe(
      `https://www.youtube.com/results?search_query=${encodeURIComponent('Čučanj')}`,
    );
  });

  it('falls back to search when every link is unsafe', () => {
    const r = resolveVideo({
      name: 'Row',
      videos: [{ url: 'javascript:alert(1)' }, { url: 'not a url' }],
    });
    expect(r.primary.kind).toBe('search');
    expect(r.all).toHaveLength(1);
  });

  it('returns a single link directly', () => {
    const r = resolveVideo({ name: 'Row', videos: [{ url: 'https://youtu.be/abc', label: 'Demo' }] });
    expect(r.primary).toEqual({ url: 'https://youtu.be/abc', label: 'Demo', kind: 'youtube' });
    expect(r.all).toHaveLength(1);
  });

  it('orders app.tytax.com first, then YouTube, then others (stable)', () => {
    const r = resolveVideo({
      name: 'Press',
      videos: [
        { url: 'https://vimeo.com/1', label: 'Vimeo' },
        { url: 'https://www.youtube.com/watch?v=1', label: 'YT1' },
        { url: 'https://m.youtube.com/watch?v=2' },
        { url: 'https://app.tytax.com/ex/9', label: 'TYTAX' },
      ],
    });
    expect(r.all.map((v) => v.kind)).toEqual(['tytax', 'youtube', 'youtube', 'other']);
    expect(r.all.map((v) => v.label)).toEqual(['TYTAX', 'YT1', undefined, 'Vimeo']);
    expect(r.primary.url).toBe('https://app.tytax.com/ex/9');
  });

  it('drops unsafe urls, duplicates and blank labels', () => {
    const r = resolveVideo({
      name: 'Press',
      videos: [
        { url: 'javascript:alert(1)', label: 'x' },
        { url: 'https://youtube.com/watch?v=1', label: '  ' },
        { url: 'https://youtube.com/watch?v=1', label: 'dup' },
      ],
    });
    expect(r.all).toEqual([{ url: 'https://youtube.com/watch?v=1', kind: 'youtube' }]);
  });

  it('does not treat look-alike hosts as tytax/youtube', () => {
    const r = resolveVideo({
      name: 'X',
      videos: [{ url: 'https://eviltytax.com/a' }, { url: 'https://youtube.com.evil.io/a' }],
    });
    expect(r.all.map((v) => v.kind)).toEqual(['other', 'other']);
  });

  it('handles videos: null', () => {
    expect(resolveVideo({ name: 'Dip', videos: null }).primary.kind).toBe('search');
  });
});
