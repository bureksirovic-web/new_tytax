/**
 * G1 present: `@/lib/training` and `@/lib/catalog` are mocked to add G1's
 * Wave 2 exports (on the integration tree they already exist; the spread keeps
 * the real ones and the spies replace them). Every G4 consumer must go through
 * them: analytics best lifts, exercise-detail e1RM, dashboard pinned card,
 * history e1RM column and editor, and the exercise video links.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise, SessionExercise, SetEntry } from '@/contracts/domain';

const g1 = vi.hoisted(() => ({
  // Sentinel e1RM: 5 reps or fewer rank at kg + 1000, anything else is not rankable.
  rankableE1rm: vi.fn((s: { kg: number; reps: number; durationSeconds?: number }) =>
    s.reps <= 5 && !(s.durationSeconds && s.durationSeconds > 0) ? s.kg + 1000 : undefined,
  ),
  isTimeSet: vi.fn((s: { durationSeconds?: number }) => typeof s.durationSeconds === 'number' && s.durationSeconds > 0),
  buildVideoLinks: vi.fn(() => [
    { href: 'https://app.tytax.com/x', kind: 'tytax' },
    { href: 'https://youtu.be/a', kind: 'youtube', n: 1 },
    { href: 'https://vimeo.com/1', kind: 'other', n: 1 },
    { href: 'https://www.youtube.com/results?search_query=Clean%20name', kind: 'search' },
  ]),
}));

vi.mock('@/lib/training', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  E1RM_MAX_REPS: 5,
  rankableE1rm: g1.rankableE1rm,
  isTimeSet: g1.isTimeSet,
}));
vi.mock('@/lib/catalog', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildVideoLinks: g1.buildVideoLinks,
}));

const { bestLifts } = await import('../exercise-series');
const { isKgSet } = await import('../analytics-math');
const { bestE1rm, isTimedSet } = await import('@/app/(app)/exercises/_components/history-stats');
const { videoLinksFor } = await import('@/app/(app)/exercises/_components/video-links');
const { VideoList } = await import('@/app/(app)/exercises/_components/video-list');
const { latestBestE1rm } = await import('@/app/(app)/dashboard/_components/pinned-math');
const { ExerciseLog } = await import('@/components/history/exercise-log');
const { logsAt, renderEn } = await import('./helpers');

const set = (over: Partial<SetEntry>): SetEntry => ({ id: 's', type: 'working', kg: 100, reps: 5, done: true, ...over });
const NOW = new Date(2026, 8, 26, 18, 0);

describe('G1 training exports present', () => {
  it('analytics best lifts and kg-set filter use them', () => {
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'a', sets: [{ kg: 80, reps: 3 }, { kg: 100, reps: 8 }] }] }]);
    expect(bestLifts(logs)).toEqual([{ exerciseId: 'a', e1rm: 1080, kg: 80, reps: 3, date: logs[0].date }]);
    expect(isKgSet(set({ durationSeconds: 0 }))).toBe(true);
  });

  it('exercise detail history stats and dashboard pinned card use them', () => {
    expect(bestE1rm([set({ kg: 60, reps: 4 }), set({ kg: 90, reps: 10 })])).toBe(1060);
    expect(isTimedSet(set({ durationSeconds: 0 }))).toBe(false);
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'a', sets: [{ kg: 70, reps: 2 }] }] }]);
    expect(latestBestE1rm(logs, 'a')?.e1rm).toBe(1070);
  });

  it('history e1RM column shows only rankable sets, even over a stored value', () => {
    const ex: SessionExercise = {
      uid: 'u',
      exerciseId: 'a',
      exerciseName: 'A',
      modality: 'kettlebell',
      sets: [set({ id: '1', kg: 40, reps: 5 }), set({ id: '2', kg: 24, reps: 35, e1rm: 432 })],
    };
    renderEn(<ExerciseLog ex={ex} units="kg" showUndone />);
    const rows = screen.getAllByTestId('history-set');
    expect(rows[0].textContent).toMatch(/1\D?040/);
    expect(rows[1].textContent).not.toMatch(/432/);
  });
});

describe('G1 catalog buildVideoLinks present', () => {
  const ex = { id: 'x', name: 'TYTAX T1 | Clean name', modality: 'tytax', videos: [] } as unknown as Exercise;

  it('maps G1 links to labelled links', () => {
    expect(videoLinksFor(ex)).toEqual([
      { href: 'https://app.tytax.com/x', kind: 'tytax', labelKey: 'ex_video_tytax' },
      { href: 'https://youtu.be/a', kind: 'youtube', labelKey: 'ex_video_youtube', vars: { n: 1 } },
      { href: 'https://vimeo.com/1', kind: 'other', labelKey: 'ex_video_n', vars: { n: 1 } },
      { href: 'https://www.youtube.com/results?search_query=Clean%20name', kind: 'search', labelKey: 'ex_video_search' },
    ]);
    expect(g1.buildVideoLinks).toHaveBeenCalledWith(ex);
  });

  it('the video list renders them with safe new-tab links', () => {
    renderEn(<VideoList exercise={ex} />);
    const links = within(screen.getByTestId('exercise-videos')).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://app.tytax.com/x',
      'https://youtu.be/a',
      'https://vimeo.com/1',
      'https://www.youtube.com/results?search_query=Clean%20name',
    ]);
    expect(links.every((a) => a.getAttribute('rel') === 'noopener noreferrer' && a.getAttribute('target') === '_blank')).toBe(true);
    expect(links[1].textContent).toContain('YouTube 1');
  });

});
