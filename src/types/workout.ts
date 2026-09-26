// Re-export of the frozen contract (src/contracts/domain.ts). Do not add types here.
import type { SetEntry } from '@/contracts/domain';

export type {
  SetType,
  SetEntry,
  SessionExercise,
  WorkoutDraft,
  WorkoutDebrief,
  WorkoutLog,
  PRType,
  PRRecord,
  BodyweightEntry,
  ExerciseNote,
  ArsenalEntry,
} from '@/contracts/domain';

/** @deprecated Use `SetEntry`. */
export type LoggedSet = SetEntry;
