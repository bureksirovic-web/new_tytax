/**
 * Legacy trainingPlan + sessionOrder (and each custom protocol) -> Program.
 *
 * Decisions:
 * - Rotation = sessionOrder; when it is empty, the plan's own key order.
 * - A session is a rest day when its name is a rest name ("Rest Day", "Rest",
 *   "Odmor", "Dan odmora", case-insensitive) or it has no exercises. Rest days
 *   carry no exercises; a rest-named session that lists exercises drops them
 *   with REST_SESSION_EXERCISES_DROPPED.
 * - A plan session that a non-empty sessionOrder does not list is not
 *   imported; it raises PLAN_SESSION_UNUSED (once per plan key).
 * - A sessionOrder name missing from the plan becomes an empty rest session
 *   with PLAN_SESSION_MISSING.
 * - Slot sets/reps come from the resolved exercise's defaults, else 3 / '8-12'.
 * - The imported plan exists only when it has at least one session; it is the
 *   one to activate. Protocols are installed inactive.
 */
import type { Program, ProgramExercise, ProgramSession } from '@/contracts';
import type { LegacyProtocol } from '../types';
import { sortedModalities } from './logs';
import type { NameTable } from './resolver';
import type { MapWarning } from './types';
import { importId } from './uuid';

export const DEFAULT_PLAN_NAME = 'TYTAX (uvezeno)';
export const FALLBACK_SETS = 3;
export const FALLBACK_REPS = '8-12';

const REST_NAMES: ReadonlySet<string> = new Set(['rest day', 'rest', 'odmor', 'dan odmora']);

export interface ProgramMapContext {
  profileId: string;
  importedAt: string;
  names: NameTable;
  warnings: MapWarning[];
}

export interface ProgramSource {
  /** Stable key: 'plan' or 'protocol:<sourceId>'. */
  key: string;
  name: string;
  plan: Readonly<Record<string, readonly string[]>>;
  order: readonly string[];
  /** Path prefix for warnings. */
  path: string;
  rotationStartDate?: string;
}

function isRestName(name: string): boolean {
  return REST_NAMES.has(name.trim().toLowerCase());
}

function mapSlot(legacyName: string, names: NameTable): ProgramExercise {
  const ref = names.ref(legacyName);
  return {
    exerciseId: ref.exerciseId,
    exerciseName: ref.exerciseName,
    modality: ref.modality,
    sets: ref.exercise?.defaultSets ?? FALLBACK_SETS,
    reps: ref.exercise?.defaultReps ?? FALLBACK_REPS,
  };
}

function mapSession(src: ProgramSource, programId: string, name: string, dayIndex: number, ctx: ProgramMapContext): ProgramSession {
  const list = Object.prototype.hasOwnProperty.call(src.plan, name) ? src.plan[name] : undefined;
  if (list === undefined) {
    ctx.warnings.push({ code: 'PLAN_SESSION_MISSING', path: `${src.path}.order[${dayIndex}]`, message: `Session "${name}" is not in the plan; imported as a rest day` });
  }
  const id = importId(ctx.profileId, 'program-session', `${src.key}|${dayIndex}`);
  const isRest = isRestName(name) || list === undefined || list.length === 0;
  if (isRest && list !== undefined && list.length > 0) {
    ctx.warnings.push({ code: 'REST_SESSION_EXERCISES_DROPPED', path: `${src.path}.plan.${name}`, message: `Rest session "${name}" lists ${list.length} exercise(s); they were not imported` });
  }
  const exercises = isRest || list === undefined ? [] : list.map((n) => mapSlot(n, ctx.names));
  const session: ProgramSession = { id, programId, name, dayIndex, exercises };
  if (isRest) session.isRest = true;
  return session;
}

export function mapProgram(src: ProgramSource, ctx: ProgramMapContext): Program | null {
  const order = src.order.length > 0 ? src.order : Object.keys(src.plan);
  if (order.length === 0) return null;
  const id = importId(ctx.profileId, 'program', src.key);
  const sessions = order.map((name, i) => mapSession(src, id, name, i, ctx));
  const listed = new Set(order);
  for (const key of Object.keys(src.plan)) {
    if (listed.has(key)) continue;
    ctx.warnings.push({ code: 'PLAN_SESSION_UNUSED', path: `${src.path}.plan.${key}`, message: `Plan session "${key}" is not in sessionOrder; it was not imported` });
  }
  const program: Program = {
    id,
    profileId: ctx.profileId,
    name: src.name,
    splitType: 'custom',
    frequency: sessions.filter((s) => s.isRest !== true).length,
    periodizationType: 'none',
    sessionOrder: [...order],
    sessions,
    modalitiesUsed: sortedModalities(sessions.flatMap((s) => s.exercises)),
    isPreset: false,
    currentSessionIndex: 0,
    createdAt: ctx.importedAt,
    updatedAt: ctx.importedAt,
  };
  if (src.rotationStartDate !== undefined) program.rotationStartDate = src.rotationStartDate;
  return program;
}

export function protocolSource(protocol: LegacyProtocol, index: number): ProgramSource {
  return {
    key: `protocol:${protocol.sourceId}`,
    name: protocol.name,
    plan: protocol.plan,
    order: protocol.order,
    path: `customProtocols[${index}]`,
  };
}
