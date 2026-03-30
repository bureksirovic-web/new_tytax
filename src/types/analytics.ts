export type ACWRStatus = 'fresh' | 'recovering' | 'fried';

export interface ACWRResult {
  muscle: string;
  acuteLoad: number;     // 7-day rolling
  chronicLoad: number;   // 28-day EWMA
  ratio: number;
  status: ACWRStatus;
  trend: 'rising' | 'stable' | 'falling';
}

export interface GapAnalysis {
  muscle: string;
  idealPercent: number;
  actualPercent: number;
  gap: number;
  isLagging: boolean;
  suggestedExercises: string[];
}

export interface VolumeDataPoint {
  week: string;          // "2026-W12"
  totalVolumeKg: number;
  sessionCount: number;
  muscleBreakdown: Record<string, number>;
}

export interface E1RMDataPoint {
  date: string;
  e1rm: number;
  weight: number;
  reps: number;
}

export interface WarmupSet {
  percent: number;
  reps: number;
  weight: number;
  label: string;
}
