// Exercise arrays are not re-exported: load them through the lazy catalog (@/lib/catalog).
export type { Gender, ExperienceLevel } from '@/types/user';
export { getRecommendedWeight, getWeightTierLabel, getNextWeightTier } from './weight-tiers';
export { KB_SIMPLE_SINISTER, KB_HYPERTROPHY, KB_CONDITIONING } from './presets';
