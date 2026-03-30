export type Modality = 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

export type MuscleGroup =
  | 'CHEST'
  | 'BACK_VERTICAL'
  | 'BACK_HORIZONTAL'
  | 'SHOULDERS'
  | 'BICEPS'
  | 'TRICEPS'
  | 'FOREARMS_GRIP'
  | 'QUADS'
  | 'HAMSTRINGS'
  | 'GLUTES'
  | 'CALVES'
  | 'CORE';

export type TechniqueLevel = 'basic' | 'intermediate' | 'advanced';

export type EquipmentRequirement =
  | 'none'
  | 'pull-up-bar'
  | 'dip-station'
  | 'rings'
  | 'parallettes'
  | 'kettlebell'
  | 'tytax';

export interface MuscleImpact {
  muscle: string;
  score: number; // 0-100
}

export interface Video {
  url: string;
  label: string;
}

export interface WeightTier {
  male: { beginner: number; intermediate: number; advanced: number };
  female: { beginner: number; intermediate: number; advanced: number };
}

export interface Exercise {
  id: string;
  name: string;
  modality: Modality;
  station?: string;           // TYTAX only
  muscleGroup: MuscleGroup;
  pattern: string;
  isUnilateral: boolean;
  defaultSets: number;
  defaultReps: string;        // "8-12" or "10-15/side"
  impact: MuscleImpact[];
  tempo?: string;             // "3-1-2-0"
  restSeconds?: number;
  videos?: Video[];
  note?: string;
  // Bodyweight specific
  difficultyLevel?: number;   // 1-10
  progressionParentId?: string;
  progressionChildIds?: string[];
  requiresEquipment?: EquipmentRequirement[];
  // Kettlebell specific
  recommendedWeightKg?: WeightTier;
  techniqueLevel?: TechniqueLevel;
  // General
  tags?: string[];
  searchTerms?: string[];
}

export interface ProgressionChain {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  exercises: string[]; // ordered exercise IDs
}
