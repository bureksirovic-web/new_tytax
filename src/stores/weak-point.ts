/**
 * Weak-point injector (pure). Documented in ./session-builder.ts, which
 * re-exports everything here.
 *
 * Availability rule (`isAvailable`): with no inventory, or an inventory with
 * nothing recorded (all four lists empty), everything is available. Otherwise:
 * - tytax: needs `stationId` in `inventory.stationIds`;
 * - kettlebell: needs at least one kettlebell in `inventory.kettlebellsKg`;
 * - bodyweight: every `requiresEquipment` item is 'none', in
 *   `inventory.bodyweightGear`, or ('tytax' → any station, 'kettlebell' → any bell);
 * - custom: always available.
 */
import type { EquipmentInventory, Exercise, ProfileSettings, SessionExercise, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { standardizeMuscle } from '@/lib/constants';
import { training } from '@/lib/training';
import { buildSessionExercise } from './session-exercise';

/** Working sets the weak-point injector adds. */
export const WEAK_POINT_SETS = 2;
/** Minimum impact score for a "primary" mover of the lagging muscle. */
export const WEAK_POINT_MIN_IMPACT = 90;
/** Days (including today) the lagging-muscle distribution looks back. */
export const WEAK_POINT_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

type Inventory = Pick<EquipmentInventory, 'stationIds' | 'attachmentIds' | 'kettlebellsKg' | 'bodyweightGear'>;

function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isEmptyInventory(inv: Inventory): boolean {
  return (
    inv.stationIds.length === 0 &&
    inv.attachmentIds.length === 0 &&
    inv.kettlebellsKg.length === 0 &&
    inv.bodyweightGear.length === 0
  );
}

export function isAvailable(exercise: Exercise, inventory?: Inventory | null): boolean {
  if (!inventory || isEmptyInventory(inventory)) return true;
  switch (exercise.modality) {
    case 'tytax':
      return exercise.stationId !== undefined && inventory.stationIds.includes(exercise.stationId);
    case 'kettlebell':
      return inventory.kettlebellsKg.length > 0;
    case 'bodyweight':
      return (exercise.requiresEquipment ?? []).every((req) => {
        if (req === 'none') return true;
        if (inventory.bodyweightGear.includes(req)) return true;
        if (req === 'tytax') return inventory.stationIds.length > 0;
        if (req === 'kettlebell') return inventory.kettlebellsKg.length > 0;
        return false;
      });
    default:
      return true;
  }
}

/** Highest impact score the exercise has for a standardised muscle name. */
export function impactFor(exercise: Exercise, muscle: string): number {
  let best = 0;
  for (const i of exercise.impact) {
    if (standardizeMuscle(i.muscle) === muscle && i.score > best) best = i.score;
  }
  return best;
}

function impactMuscleCount(exercise: Exercise): number {
  return new Set(exercise.impact.filter((i) => i.score > 0).map((i) => standardizeMuscle(i.muscle))).size;
}

export interface WeakPointInput {
  /** Recent logs (at least the last 7 days); also the prefill source for the pick. */
  history: readonly WorkoutLog[];
  lookup: ExerciseLookup;
  catalogExercises: readonly Exercise[];
  sessionExercises: readonly SessionExercise[];
  settings: ProfileSettings;
  inventory?: Inventory | null;
  now: Date;
}

export interface WeakPointPick {
  /** Standardised muscle name (e.g. 'Rear Delts'). */
  muscle: string;
  exercise: Exercise;
  sets: typeof WEAK_POINT_SETS;
  /** Ready to append: exactly 2 prefilled working sets, no warm-ups. */
  sessionExercise: SessionExercise;
}

export function weakPoint(input: WeakPointInput): WeakPointPick | null {
  const { history, lookup, settings, now } = input;
  if (!settings.weakPointInjector) return null;
  if (training.recoveryStatus(history, lookup, now).overall !== 'fresh') return null;
  const from = localDay(new Date(now.getTime() - (WEAK_POINT_WINDOW_DAYS - 1) * DAY_MS));
  const distribution = training.impactDistribution(history, lookup, { from, to: localDay(now) });
  const lagging = training.laggingMuscle(distribution);
  if (!lagging) return null;
  const inSession = new Set(input.sessionExercises.map((e) => e.exerciseId));
  const candidates = input.catalogExercises
    .filter((e) => !inSession.has(e.id))
    .filter((e) => impactFor(e, lagging.muscle) >= WEAK_POINT_MIN_IMPACT)
    .filter((e) => isAvailable(e, input.inventory))
    .sort((a, b) => impactMuscleCount(a) - impactMuscleCount(b) || a.name.localeCompare(b.name));
  const exercise = candidates[0];
  if (!exercise) return null;
  const sessionExercise = buildSessionExercise({
    exercise,
    history,
    settings,
    targetSets: WEAK_POINT_SETS,
    warmups: false,
  });
  return { muscle: lagging.muscle, exercise, sets: WEAK_POINT_SETS, sessionExercise };
}
