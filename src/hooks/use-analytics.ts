'use client';
/**
 * Stable hook path for analytics data. Implementation lives next to the
 * analytics components (`src/components/analytics/use-analytics-data.ts`).
 */
export {
  useAnalyticsData,
  useAnalyticsData as useAnalytics,
  useExerciseHistory,
  useExerciseNames,
  useBodyweightEntries,
  usePinnedExercises,
  readPins,
  savePins,
  MAX_PINNED,
  localDayDaysAgo,
} from '@/components/analytics/use-analytics-data';
export type { AnalyticsData, ExerciseNames } from '@/components/analytics/use-analytics-data';
