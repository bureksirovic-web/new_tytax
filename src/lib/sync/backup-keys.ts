/** SyncTable → the `BackupV3` array that holds its local records. */
import type { BackupV3 } from '@/contracts/repo';
import type { SyncTable } from '@/contracts/sync';

export type BackupKey = Exclude<keyof BackupV3, 'format' | 'version' | 'exportedAt'>;

export const BACKUP_KEY: Readonly<Record<SyncTable, BackupKey>> = Object.freeze({
  profiles: 'profiles',
  workout_logs: 'workoutLogs',
  programs: 'programs',
  pr_records: 'prRecords',
  bodyweight_entries: 'bodyweightEntries',
  exercise_notes: 'exerciseNotes',
  arsenal: 'arsenal',
  equipment: 'equipment',
});
