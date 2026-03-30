import type { WorkoutLog } from '@/types/workout';
import { escapeCSV } from '@/lib/utils';

export function workoutLogsToCSV(logs: WorkoutLog[]): string {
  const headers = ['Date', 'Duration (min)', 'Exercise', 'Set #', 'Weight (kg)', 'Reps', 'Volume', 'Modality'];
  const rows: string[][] = [headers];

  for (const log of logs) {
    for (const ex of log.exercises) {
      ex.sets.forEach((set, i) => {
        rows.push([
          log.date,
          String(Math.round(log.durationSeconds / 60)),
          ex.exerciseName,
          String(i + 1),
          String(set.kg ?? ''),
          String(set.reps ?? ''),
          String((set.kg ?? 0) * Number(set.reps ?? 0)),
          ex.modality ?? '',
        ]);
      });
    }
  }

  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
