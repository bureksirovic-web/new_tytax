import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { sameTimeLastWeek, weeklyVolume } from '../dashboard-math';
import { WeeklyVolumeCard } from '../weekly-volume-card';

// Monday 2026-09-28 09:00 local. Last week: Mon 09-21 … Sun 09-27; same point last week = Mon 09-21 09:00.
const MON = new Date(2026, 8, 28, 9, 0, 0);
const HOUR = 1 / 24;
const ids = sequentialIds('w2v');
const log = (daysAgo: number, kg: number, reps: number) =>
  buildWorkoutLog('p1', { daysAgo, exercises: [{ exerciseId: 'x', sets: [{ kg, reps }] }] }, MON, ids);

describe('W2 S3: weekly volume % compares the same elapsed part of both weeks', () => {
  it('same weekday and clock time a week earlier', () => {
    expect(sameTimeLastWeek(MON)).toEqual(new Date(2026, 8, 21, 9, 0, 0));
  });

  it('Monday 09:00 with nothing yet: no "-100 %" against a whole finished week', () => {
    // Tue 09-22 09:00–10:00: 50 × 10 = 500 kg, after the cutoff (Mon 09-21 09:00).
    const v = weeklyVolume([log(6, 50, 10)], MON);
    expect(v).toEqual({ thisWeekKg: 0, lastWeekKg: 500, lastWeekToDateKg: 0, changePct: null });
  });

  it('counts last week only up to the cutoff, by end time', () => {
    const logs = [
      // Mon 09-21 07:00–08:00 (ends before 09:00): 100 × 3 = 300 kg → to date.
      log(7 + 2 * HOUR, 100, 3),
      // Mon 09-21 08:30–09:30 (ends after 09:00): 20 × 10 = 200 kg → whole week only.
      log(7 + 0.5 * HOUR, 20, 10),
      // Tue 09-22 09:00–10:00: 500 kg → whole week only.
      log(6, 50, 10),
      // Mon 09-28 07:00–08:00, this week: 60 × 6 = 360 kg.
      log(2 * HOUR, 60, 6),
    ];
    const v = weeklyVolume(logs, MON);
    // this 360; last whole 300 + 200 + 500 = 1000; to date 300; (360 − 300) / 300 = +20 %.
    expect(v).toEqual({ thisWeekKg: 360, lastWeekKg: 1000, lastWeekToDateKg: 300, changePct: 20 });
  });

  it('the card says what it compares', () => {
    window.localStorage.setItem('locale', 'en');
    const wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
    render(<WeeklyVolumeCard volume={{ thisWeekKg: 360, lastWeekKg: 1000, lastWeekToDateKg: 300, changePct: 20 }} units="kg" />, { wrapper });
    expect(screen.getByTestId('dash-volume-change')).toHaveTextContent('20% more than at this point last week');
    expect(screen.getByTestId('dash-volume-last-to-date')).toHaveTextContent('Last week by this point: 300 kg');
    expect(screen.getByText(/this week so far with last week up to the same day and time/)).toBeInTheDocument();
  });
});
