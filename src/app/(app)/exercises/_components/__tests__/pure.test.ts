import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { EMPTY_FILTER, hasActiveFilters, parseLibraryParams, serializeLibraryParams, toCatalogQuery } from '../library-params';
import { attachmentKey, impactLevel, impactMuscleKey, stationKey } from '../labels';
import { bestE1rm, bestPoint, doneWorkingSets, e1rmSeries } from '../history-stats';
import { buildVideoLinks } from '../video-links';
import { chartCoords } from '../e1rm-chart';

describe('library params', () => {
  it('round-trips every filter through the URL query', () => {
    const qs = 'q=bench&m=tytax&mg=CHEST&st=smith&att=rope&favorites=1';
    const f = parseLibraryParams(new URLSearchParams(qs));
    expect(f).toEqual({ q: 'bench', modality: 'tytax', muscleGroup: 'CHEST', stationId: 'smith', attachmentId: 'rope', favorites: true });
    expect(serializeLibraryParams(f)).toBe(qs);
    expect(toCatalogQuery(f)).toEqual({ text: 'bench', modality: 'tytax', muscleGroup: 'CHEST', stationId: 'smith', attachmentId: 'rope' });
  });

  it('drops invalid values and TYTAX-only filters for other modalities', () => {
    const f = parseLibraryParams(new URLSearchParams('m=yoga&mg=NECK&st=<script>&favorites=yes'));
    expect(f).toEqual(EMPTY_FILTER);
    const bw = parseLibraryParams(new URLSearchParams('m=bodyweight&st=smith&att=rope'));
    expect(serializeLibraryParams(bw)).toBe('m=bodyweight');
    expect(toCatalogQuery(bw).stationId).toBeUndefined();
    expect(hasActiveFilters(EMPTY_FILTER)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTER, favorites: true })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTER, q: 'x' })).toBe(true);
  });
});

describe('labels', () => {
  it('maps thresholds and ids', () => {
    expect([impactLevel(90), impactLevel(89), impactLevel(50), impactLevel(49)]).toEqual(['primary', 'secondary', 'secondary', 'tertiary']);
    expect(impactMuscleKey('ANTERIOR DELT')).toBe('ex_mdetail_front_delts');
    expect(impactMuscleKey('Something odd')).toBeUndefined();
    expect(stationKey('back-upper')).toBe('ex_station_back_upper');
    // tytax_library.json keys resolve to the same labels as the older ids
    expect(stationKey('BACK_UPPER')).toBe('ex_station_back_upper');
    expect(attachmentKey('TRICEPS_ROPE')).toBe(attachmentKey('rope'));
    expect(attachmentKey('EZ_LAT_BAR')).toBe('ex_att_ez_bar');
    expect(attachmentKey('UNKNOWN_THING')).toBeUndefined();
  });
});

describe('history stats', () => {
  const now = new Date(2026, 8, 26, 12);
  const ids = sequentialIds('h');
  const log = (daysAgo: number, sets: Parameters<typeof buildWorkoutLog>[1]['exercises'][number]['sets'], deleted = false): WorkoutLog =>
    buildWorkoutLog('p1', { daysAgo, deleted, exercises: [{ exerciseId: 'ex1', sets }, { exerciseId: 'other', sets: [{ kg: 300, reps: 1 }] }] }, now, ids);

  it('uses only done working sets of the exercise and orders points by date (spec hand-check)', () => {
    // 6 days ago: 100×5 @2, 100×5 @1 → Brzycki 100·36/32 = 112.5
    // 2 days ago: 105×3 → 105·36/34 = 111.176 → 111.2; warm-up 50×10 (=66.7) and undone 200×5 ignored
    const older = log(6, [{ kg: 100, reps: 5, rir: 2 }, { kg: 100, reps: 5, rir: 1 }]);
    const newer = log(2, [{ kg: 105, reps: 3 }, { kg: 50, reps: 10, type: 'warmup' }, { kg: 200, reps: 5, done: false }]);
    const deleted = log(1, [{ kg: 500, reps: 5 }], true);
    expect(doneWorkingSets(newer, 'ex1')).toHaveLength(1);
    expect(bestE1rm(doneWorkingSets(older, 'ex1'))).toBe(112.5);
    const series = e1rmSeries([newer, deleted, older], 'ex1');
    expect(series.map((p) => p.e1rm)).toEqual([112.5, 111.2]);
    expect(bestPoint(series)?.logId).toBe(older.id);
    // A log with only warm-ups for the exercise yields no point.
    expect(e1rmSeries([log(3, [{ kg: 60, reps: 5, type: 'warmup' }])], 'ex1')).toEqual([]);
  });

  it('maps chart points into the viewBox (min at bottom, max at top)', () => {
    const c = chartCoords([
      { logId: 'a', date: '2026-09-01', e1rm: 100 },
      { logId: 'b', date: '2026-09-02', e1rm: 110 },
    ]);
    // W=300,H=120,PAD=8 → x: 8 and 292; y: min→112, max→8
    expect(c).toEqual([{ x: 8, y: 112 }, { x: 292, y: 8 }]);
  });
});

describe('video links', () => {
  it('labels by host, numbers YouTube links, drops non-http urls, appends a search', () => {
    const links = buildVideoLinks(
      [
        { url: 'https://app.tytax.com/en/x', label: 'TYTAX' },
        { url: 'https://www.youtube.com/watch?v=a', label: 'a' },
        { url: 'javascript:alert(1)', label: 'bad' },
        { url: 'https://youtu.be/b', label: 'b' },
      ],
      'Smith Bench & Press',
    );
    expect(links.map((l) => [l.labelKey, l.vars?.n])).toEqual([
      ['ex_video_tytax', undefined],
      ['ex_video_youtube', 1],
      ['ex_video_youtube', 2],
      ['ex_video_search', undefined],
    ]);
    expect(links[3].href).toBe('https://www.youtube.com/results?search_query=Smith%20Bench%20%26%20Press');
    expect(buildVideoLinks(undefined, 'X')).toHaveLength(1);
  });
});
