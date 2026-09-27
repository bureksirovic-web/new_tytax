/**
 * Session kind and the slot editor's smart context filter (legacy
 * L4455-4565, requests G4-15 / G4-16). Pure. Ported from G4's tested local
 * adapter `src/components/programs/lib/slot-filter.ts`.
 */
import type { Exercise, MuscleGroup, Program, ProgramSession } from '@/contracts/domain';

export type SessionKind = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export const SESSION_KINDS: readonly SessionKind[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs'];

/** Muscle filter chips of the slot editor: every muscle group, plus the ALL and BACK meta chips. */
export type MuscleChip = 'ALL' | 'BACK' | MuscleGroup;

export const MUSCLE_CHIPS: readonly MuscleChip[] = [
  'ALL', 'CHEST', 'BACK', 'BACK_VERTICAL', 'BACK_HORIZONTAL', 'SHOULDERS', 'BICEPS', 'TRICEPS',
  'FOREARMS_GRIP', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'CORE',
];

/**
 * A session that may carry the optional `kind` requested in G4-15. The field
 * is not in the frozen contract yet, so it is read through this local type.
 */
export type SessionWithKind = ProgramSession & { kind?: SessionKind };

/** en/hr name keywords, first match wins. */
const NAME_KINDS: ReadonlyArray<readonly [RegExp, SessionKind]> = [
  [/\b(push|potisak)\b/, 'push'],
  [/\b(pull|povla[cč]enje)\b/, 'pull'],
  [/\b(legs|noge)\b/, 'legs'],
  [/\b(upper|gornji)\b/, 'upper'],
  [/\b(lower|donji)\b/, 'lower'],
  [/\b(full|cijelo)\b/, 'full'],
];

const SPLIT_KINDS: Record<'full_body' | 'upper_lower' | 'push_pull_legs', readonly SessionKind[]> = {
  full_body: ['full'],
  upper_lower: ['upper', 'lower'],
  push_pull_legs: ['push', 'pull', 'legs'],
};

function isSessionKind(v: unknown): v is SessionKind {
  return typeof v === 'string' && (SESSION_KINDS as readonly string[]).includes(v);
}

/**
 * Kind of a session. Order: a stored `kind` (G4-15; ignored unless it is a
 * valid kind), the name (en/hr keywords; covers presets like "Upper A" and
 * "Gornji A"), then split + position among training days. Rest days and
 * custom splits without a keyword → null (no context filtering).
 */
export function sessionKind(program: Pick<Program, 'splitType' | 'sessions'>, session: SessionWithKind): SessionKind | null {
  if (session.isRest) return null;
  if (isSessionKind(session.kind)) return session.kind;
  const name = session.name.toLowerCase();
  for (const [re, kind] of NAME_KINDS) if (re.test(name)) return kind;
  if (program.splitType === 'custom') return null;
  const pattern = SPLIT_KINDS[program.splitType];
  const i = program.sessions.filter((s) => !s.isRest).findIndex((s) => s.id === session.id);
  return i >= 0 ? pattern[i % pattern.length] : null;
}

function kindFlags(kind: SessionKind | null) {
  return {
    upper: kind === 'upper' || kind === 'push',
    lower: kind === 'lower' || kind === 'legs',
    pull: kind === 'pull',
  };
}

const HIDDEN_UPPER: readonly MuscleChip[] = ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES'];
const HIDDEN_PULL: readonly MuscleChip[] = ['QUADS', 'CALVES', 'CHEST', 'TRICEPS'];
const HIDDEN_LOWER: readonly MuscleChip[] = ['CHEST', 'BACK', 'BACK_VERTICAL', 'BACK_HORIZONTAL', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS_GRIP'];

/** Muscle chips the smart filter hides for a session kind (legacy L4552-4565). */
export function hiddenMuscleChips(kind: SessionKind | null): ReadonlySet<MuscleChip> {
  const f = kindFlags(kind);
  const out = new Set<MuscleChip>();
  if (f.upper && !f.pull) HIDDEN_UPPER.forEach((c) => out.add(c));
  if (f.pull) HIDDEN_PULL.forEach((c) => out.add(c));
  if (f.lower) HIDDEN_LOWER.forEach((c) => out.add(c));
  return out;
}

const CORE = ['abs', 'obliques', 'core', 'serratus'];
const LEGS = ['quad', 'hamstring', 'glute', 'calf', 'calves', 'soleus', 'gastrocnemius'];
const UPPER = ['chest', 'back', 'lat', 'trap', 'rhomboid', 'delt', 'shoulder', 'bicep', 'tricep', 'forearm', 'grip', 'brach', 'rotator'];
const PULL_EXCLUDE = ['quad', 'chest', 'tricep', 'front delt', 'calf', 'calves', 'soleus'];

/** Primary muscles: impact score ≥ 90 (legacy getImpact level rule). */
function primaryHits(ex: Pick<Exercise, 'impact'>, fragments: readonly string[]): boolean {
  return ex.impact.some((i) => i.score >= 90 && fragments.some((f) => i.muscle.toLowerCase().includes(f)));
}

/**
 * Smart context filter (legacy L4455-4484). Core-primary exercises are always
 * allowed. Upper/push excludes leg-primary, lower/legs excludes upper-primary,
 * pull excludes quad/chest/triceps/front-delt/calf-primary. Full or null
 * allows everything.
 */
export function sessionContextAllows(kind: SessionKind | null, exercise: Pick<Exercise, 'impact'>): boolean {
  const f = kindFlags(kind);
  if (!f.upper && !f.lower && !f.pull) return true;
  if (primaryHits(exercise, CORE)) return true;
  if (f.upper && primaryHits(exercise, LEGS)) return false;
  if (f.lower && primaryHits(exercise, UPPER)) return false;
  if (f.pull && primaryHits(exercise, PULL_EXCLUDE)) return false;
  return true;
}
