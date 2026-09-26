/** Test helpers for the analytics components (fixtures come from @/contracts/fixtures). */
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { Exercise, MuscleImpact, SetEntry, WorkoutLog } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import type { ExerciseLookup } from '@/contracts/training';
import { buildWorkoutLog, sequentialIds, type SeedExerciseInput } from '@/contracts/fixtures';
import { LocaleProvider } from '@/components/providers/locale-provider';

export const DAY_MS = 86_400_000;

/** Minimal catalog entry: only id, name, pattern and impact matter to analytics. */
export function exercise(id: string, impact: MuscleImpact[], pattern = 'horizontal push'): Exercise {
  return {
    id, name: id.toUpperCase(), modality: 'tytax', muscleGroup: 'CHEST', pattern, isUnilateral: false,
    defaultSets: 3, defaultReps: '8-12', impact,
  };
}

export function lookupOf(list: Exercise[]): ExerciseLookup {
  const map = new Map(list.map((e) => [e.id, e]));
  return (id) => map.get(id);
}

/** Build logs relative to `now` with deterministic ids. */
export function logsAt(now: Date, specs: Array<{ daysAgo: number; deleted?: boolean; exercises: SeedExerciseInput[] }>, profileId = 'p1'): WorkoutLog[] {
  const ids = sequentialIds('t');
  return specs.map((s) => buildWorkoutLog(profileId, s, now, ids));
}

/** Finish a workout through the repository, `daysAgo` days before now. */
export async function seedLog(
  repo: Repository,
  profileId: string,
  id: string,
  daysAgo: number,
  exerciseId: string,
  sets: Array<Pick<SetEntry, 'kg' | 'reps'> & Partial<Pick<SetEntry, 'type' | 'done'>>>,
): Promise<void> {
  const started = new Date(Date.now() - daysAgo * DAY_MS);
  await repo.finishWorkout(
    {
      id,
      profileId,
      sessionName: id,
      startedAt: started.toISOString(),
      exercises: [
        {
          uid: `u-${id}`,
          exerciseId,
          exerciseName: `snap-${exerciseId}`,
          modality: 'tytax',
          sets: sets.map((s, i) => ({ id: `${id}-s${i}`, type: s.type ?? 'working', kg: s.kg, reps: s.reps, done: s.done ?? true })),
        },
      ],
    },
    { finishedAt: new Date(started.getTime() + 3_600_000).toISOString() },
  );
}

/** Render inside LocaleProvider in English so string assertions are stable. */
export function renderEn(ui: ReactElement, options?: RenderOptions) {
  window.localStorage.setItem('locale', 'en');
  const Wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;
  return render(ui, { wrapper: Wrapper, ...options });
}
