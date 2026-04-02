import type { Exercise } from '@/types/exercise';
import type { Gender, ExperienceLevel } from '@/types/user';

export function getRecommendedWeight(
  exercise: Exercise,
  gender: Gender,
  level: ExperienceLevel
): number {
  if (!exercise.recommendedWeightKg) return 16;
  return exercise.recommendedWeightKg[gender][level];
}

export function getWeightTierLabel(level: ExperienceLevel): string {
  const labels: Record<ExperienceLevel, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };
  return labels[level];
}

export function getNextWeightTier(
  exercise: Exercise,
  gender: Gender,
  currentWeight: number
): number | null {
  if (!exercise.recommendedWeightKg) return null;
  const tiers = exercise.recommendedWeightKg[gender];
  const weights = [tiers.beginner, tiers.intermediate, tiers.advanced];
  const higher = weights.filter(w => w > currentWeight);
  return higher.length > 0 ? Math.min(...higher) : null;
}
