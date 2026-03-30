export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type WorkoutState = 'idle' | 'selecting' | 'active' | 'paused' | 'debriefing' | 'complete';

export interface LoggedSet {
  id: string;
  setNumber: number;
  type: SetType;
  kg: number;
  reps: number;
  rir?: number;        // 0-4 Reps In Reserve
  tempo?: string;
  done: boolean;
  isPersonalRecord?: boolean;
  e1rm?: number;
  timestamp: string;
}

export interface ExerciseLog {
  exerciseRef: string;       // exercise ID from data module
  exerciseName: string;
  modality: string;
  supersetGroup?: string;    // 'A', 'B', 'C'
  sets: LoggedSet[];
  restSeconds?: number;
  notes?: string;
  muscleImpactSnapshot?: Array<{ muscle: string; score: number }>;
}

export interface WorkoutLog {
  id: string;
  profileId: string;
  familyMemberId?: string;
  programId?: string;
  sessionName: string;
  date: string;              // ISO date "2026-03-30"
  startedAt: string;         // ISO datetime
  finishedAt?: string;
  durationSeconds: number;
  exercises: ExerciseLog[];
  notes?: string;
  rpe?: number;              // 1-10
  bodyweightKg?: number;
  totalVolumeKg: number;
  totalSets: number;
  prCount: number;
  modalitiesUsed: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncedAt?: string;
}

export interface PRRecord {
  id: string;
  profileId: string;
  exerciseId: string;
  exerciseName: string;
  prType: 'weight' | 'reps' | 'volume' | 'e1rm';
  value: number;
  reps?: number;
  achievedAt: string;
  workoutLogId: string;
}

export interface BodyweightEntry {
  id: string;
  profileId: string;
  date: string;
  valueKg: number;
  createdAt: string;
}
