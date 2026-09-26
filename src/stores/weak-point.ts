/**
 * Weak-point injector (pure). Documented in ./session-builder.ts, which
 * re-exports everything here.
 *
 * Availability rule (`isAvailable`): with no inventory, or an inventory with
 * nothing recorded (all four lists empty), everything is available. Otherwise:
 * - tytax: its station (`stationId`, else the display `station`) must be in
 *   `inventory.stationIds`, compared by `stationKey` (case/format-insensitive:
 *   wave-0 'back-upper' = G1 'BACK_UPPER' = 'Back Upper Pulley'); an exercise
 *   with no station at all is unknown, not missing, and counts as available;
 * - kettlebell: needs at least one kettlebell in `inventory.kettlebellsKg`;
 * - bodyweight: every `requiresEquipment` item is 'none', in
 *   `inventory.bodyweightGear`, or ('tytax' → any station, 'kettlebell' → any bell);
 * - custom: always available.
 */
import type { EquipmentInventory, Exercise, ProfileSettings, SessionExercise, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { standardizeMuscle } from '@/lib/constants';
import { training } from '@/lib/training';
import { exerciseStationKey, stationKey } from './order-by-station';
import { buildSessionExercise } from './session-exercise';

/** Working sets the weak-point injector adds. */
export const WEAK_POINT_SETS = 2;
/** Minimum impact score for a "primary" mover of the lagging muscle. */
export const WEAK_POINT_MIN_IMPACT = 90;
/** Fallback floor when no available exercise reaches `WEAK_POINT_MIN_IMPACT` for the lagging muscle. */
export const WEAK_POINT_FALLBACK_MIN_IMPACT = 60;
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

/** True when the exercise has no known station, or its station is among `stationIds` (any id format). */
export function ownsStation(exercise: Pick<Exercise, 'stationId' | 'station'>, stationIds: readonly string[]): boolean {
  const key = exerciseStationKey(exercise);
  return key === undefined || stationIds.some((id) => stationKey(id) === key);
}

export function isAvailable(exercise: Exercise, inventory?: Inventory | null): boolean {
  if (!inventory || isEmptyInventory(inventory)) return true;
  switch (exercise.modality) {
    case 'tytax':
      return ownsStation(exercise, inventory.stationIds);
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
  const usable = input.catalogExercises.filter((e) => !inSession.has(e.id) && isAvailable(e, input.inventory));
  const primary = usable
    .filter((e) => impactFor(e, lagging.muscle) >= WEAK_POINT_MIN_IMPACT)
    .sort((a, b) => impactMuscleCount(a) - impactMuscleCount(b) || a.name.localeCompare(b.name));
  // Fallback (F7): some muscles (e.g. Upper Traps) have no exercise at >= 90 in the catalog.
  const fallback = () =>
    usable
      .filter((e) => impactFor(e, lagging.muscle) >= WEAK_POINT_FALLBACK_MIN_IMPACT)
      .sort(
        (a, b) =>
          impactFor(b, lagging.muscle) - impactFor(a, lagging.muscle) ||
          impactMuscleCount(a) - impactMuscleCount(b) ||
          a.name.localeCompare(b.name),
      );
  const exercise = primary[0] ?? fallback()[0];
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
