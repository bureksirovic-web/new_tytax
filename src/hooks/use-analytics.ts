'use client';
/**
 * Wave 0: analytics now read logs through the repository and the lazy catalog
 * (`src/components/analytics/use-analytics-data.ts`). Kept as the stable hook path.
 */
export {
  useAnalyticsData as useAnalytics,
  useExerciseAnalyticsData as useExerciseAnalytics,
} from '@/components/analytics/use-analytics-data';
