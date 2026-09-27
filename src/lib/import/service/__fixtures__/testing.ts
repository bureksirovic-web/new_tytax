/** Test-only helpers for the import services (synthetic data only). */
import type { BackupV3, Exercise, Repository } from '@/contracts';
import type { LegacyNameResolver } from '../../map/types';
import { createFallbackResolver } from '../../map/resolver';

function ex(id: string, name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    modality: 'tytax',
    muscleGroup: 'CHEST',
    pattern: 'push',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '8-12',
    impact: [{ muscle: 'Chest', score: 90 }],
    ...extra,
  };
}

/** Synthetic catalog slice: bench by legacyName, squat and row by name; the rest stay unresolved. */
export const SYNTHETIC_EXERCISES: readonly Exercise[] = [
  ex('t-bench', 'Flat Bench (Smith)', { legacyName: 'TYTAX T1 | Smith Flat Bench Press' }),
  ex('t-squat', 'Smith Back Squat', { muscleGroup: 'QUADS' }),
  ex('t-row', 'Lower Pulley Seated Cable Row (bench)', { muscleGroup: 'BACK_HORIZONTAL' }),
];

export const syntheticResolver = (): LegacyNameResolver => createFallbackResolver(SYNTHETIC_EXERCISES);

/** Wraps a resolver so it throws on call number `failOn` (1-based); `calls()` counts lookups. */
export function countingResolver(failOn = Number.POSITIVE_INFINITY): LegacyNameResolver & { calls(): number } {
  const inner = syntheticResolver();
  let n = 0;
  return {
    getByLegacyName(name: string) {
      n += 1;
      if (n >= failOn) throw new Error('resolver exploded');
      return inner.getByLegacyName(name);
    },
    calls: () => n,
  };
}

export type Snapshot = Omit<BackupV3, 'exportedAt'>;

/** Every table's rows (soft-deleted included), without the export timestamp. */
export async function snapshot(repo: Repository, profileId?: string): Promise<Snapshot> {
  const full = await repo.exportBackup(profileId);
  const out: Partial<BackupV3> = { ...full };
  delete out.exportedAt;
  return out as Snapshot;
}
