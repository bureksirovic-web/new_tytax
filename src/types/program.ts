export type SplitType =
  | 'full_body'
  | 'upper_lower'
  | 'push_pull_legs'
  | 'custom';

export type PeriodizationType = 'none' | 'linear' | 'undulating' | 'block';

export interface PeriodizationConfig {
  type: PeriodizationType;
  // Linear: add X kg every N weeks
  linearIncrement?: number;
  linearFrequencyWeeks?: number;
  // Undulating: alternating rep ranges per session
  undulatingRanges?: string[];
  // Block: phases in weeks
  blockPhases?: Array<{ name: string; weeks: number; focus: string }>;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  modality: string;
  sets: number;
  reps: string;
  tempo?: string;
  restSeconds?: number;
  supersetGroup?: string;
}

export interface ProgramSession {
  id: string;
  programId: string;
  name: string;
  dayIndex: number;
  exercises: SessionExercise[];
}

export interface Program {
  id: string;
  profileId: string;
  name: string;
  splitType: SplitType;
  frequency: number;         // days per week
  periodizationType: PeriodizationType;
  periodizationConfig?: PeriodizationConfig;
  sessionOrder: string[];    // session names in rotation
  sessions: ProgramSession[];
  modalitiesUsed: string[];
  isActive: boolean;
  isPreset: boolean;
  currentSessionIndex: number;
  rotationStartDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
