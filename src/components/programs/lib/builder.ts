/**
 * Pure helpers for the program builder wizard (/programs/new).
 * Slot naming follows legacy handleWizardComplete (index.html L4357-4378):
 * always a letter suffix per round, so PPL×5 → Push A, Pull A, Legs A, Push B, Pull B.
 */
import type { Modality, ProgramSession, ProgramTemplate, SplitType } from '@/contracts/domain';

export type BuilderSplit = Exclude<SplitType, 'custom'>;

export const FREQ_OPTIONS: readonly number[] = [2, 3, 4, 5, 6];

/** Session names per split; stored program data (like preset names), not UI copy. */
const SPLIT_PATTERN: Record<BuilderSplit, readonly string[]> = {
  full_body: ['Full Body'],
  upper_lower: ['Upper', 'Lower'],
  push_pull_legs: ['Push', 'Pull', 'Legs'],
};

export interface SplitOption {
  split: BuilderSplit;
  recommended: boolean;
}

/**
 * Split choices for `days` (legacy L4080-4105): days ≥ 5 → PPL, UL; 4 → UL, PPL;
 * ≤ 3 → FB, UL. Those two are recommended; the remaining split follows as "Other".
 */
export function splitOptions(days: number): SplitOption[] {
  const recommended: BuilderSplit[] =
    days >= 5 ? ['push_pull_legs', 'upper_lower'] : days === 4 ? ['upper_lower', 'push_pull_legs'] : ['full_body', 'upper_lower'];
  const all: BuilderSplit[] = ['full_body', 'upper_lower', 'push_pull_legs'];
  return [
    ...recommended.map((split) => ({ split, recommended: true })),
    ...all.filter((s) => !recommended.includes(s)).map((split) => ({ split, recommended: false })),
  ];
}

/** Slot names for `days` training days of `split`. */
export function slotNames(split: BuilderSplit, days: number): string[] {
  const pattern = SPLIT_PATTERN[split];
  const n = Math.max(0, Math.floor(days));
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    names.push(`${pattern[i % pattern.length]} ${String.fromCharCode(65 + Math.floor(i / pattern.length))}`);
  }
  return names;
}

export interface BuilderInput {
  days: number;
  split: BuilderSplit;
  /** Program name (already translated by the caller). */
  name: string;
  /** Name of the trailing rest-day session (translated by the caller). */
  restDayName: string;
  /** Local 'YYYY-MM-DD'. */
  today: string;
  modality?: Modality;
  newId?: () => string;
}

/**
 * The template the wizard persists: one empty session per training day plus a
 * trailing rest day (legacy always appended "Rest Day", L4410-4411), pointer on
 * the first session, rotation starting today.
 */
export function buildBuilderTemplate(input: BuilderInput): ProgramTemplate {
  const newId = input.newId ?? (() => crypto.randomUUID());
  const modality = input.modality ?? 'tytax';
  const training: ProgramSession[] = slotNames(input.split, input.days).map((name, i) => ({
    id: newId(),
    programId: '',
    name,
    dayIndex: i,
    exercises: [],
    isRest: false,
  }));
  const rest: ProgramSession = {
    id: newId(),
    programId: '',
    name: input.restDayName,
    dayIndex: training.length,
    exercises: [],
    isRest: true,
  };
  const sessions = [...training, rest];
  return {
    name: input.name.trim(),
    splitType: input.split,
    frequency: input.days,
    periodizationType: 'none',
    sessionOrder: sessions.map((s) => s.name),
    sessions,
    modalitiesUsed: [modality],
    isPreset: false,
    currentSessionIndex: 0,
    rotationStartDate: input.today,
  };
}
