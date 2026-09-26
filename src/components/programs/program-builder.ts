/**
 * Pure helpers for the program builder (programs/new): option lists and the
 * `ProgramTemplate` it saves through `repo.programs.create`.
 */
import type { Modality, ProgramSession, ProgramTemplate, SplitType } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';

export const MODALITY_OPTIONS: ReadonlyArray<{ value: Modality; labelKey: TranslationKey }> = [
  { value: 'tytax', labelKey: 'modality_tytax_t1' },
  { value: 'bodyweight', labelKey: 'modality_bodyweight' },
  { value: 'kettlebell', labelKey: 'modality_kettlebell' },
  { value: 'custom', labelKey: 'modality_custom' },
];

export const SPLIT_OPTIONS: ReadonlyArray<{ value: SplitType; labelKey: TranslationKey; minDays: number }> = [
  { value: 'full_body', labelKey: 'full_body', minDays: 2 },
  { value: 'upper_lower', labelKey: 'upper_lower', minDays: 2 },
  { value: 'push_pull_legs', labelKey: 'push_pull_legs', minDays: 3 },
  { value: 'custom', labelKey: 'custom', minDays: 1 },
];

export const FREQ_OPTIONS: readonly number[] = [2, 3, 4, 5, 6];

/** Session names per split; stored program data, not UI copy. */
const SPLIT_PATTERN: Record<SplitType, readonly string[]> = {
  full_body: ['Full Body'],
  upper_lower: ['Upper', 'Lower'],
  push_pull_legs: ['Push', 'Pull', 'Legs'],
  custom: ['Session'],
};

export interface BuilderInput {
  name: string;
  modality: Modality;
  split: SplitType;
  frequency: number;
}

/**
 * One empty session per training day, cycling through the split's pattern.
 * When the week holds more days than the pattern, each round gets a letter
 * suffix (Upper A, Lower A, Upper B, …). `programId` is left empty: the
 * repository assigns real program and session ids on create.
 */
export function generateSessions(split: SplitType, frequency: number, newId: () => string = () => crypto.randomUUID()): ProgramSession[] {
  const pattern = SPLIT_PATTERN[split];
  const days = Math.max(0, Math.floor(frequency));
  const sessions: ProgramSession[] = [];
  for (let i = 0; i < days; i++) {
    const label = pattern[i % pattern.length];
    const suffix = days > pattern.length ? ` ${String.fromCharCode(65 + Math.floor(i / pattern.length))}` : '';
    sessions.push({ id: newId(), programId: '', name: `${label}${suffix}`, dayIndex: i, exercises: [] });
  }
  return sessions;
}

/** The template the builder hands to `repo.programs.create`. */
export function buildProgramTemplate(input: BuilderInput, newId?: () => string): ProgramTemplate {
  const sessions = generateSessions(input.split, input.frequency, newId);
  return {
    name: input.name.trim(),
    splitType: input.split,
    frequency: input.frequency,
    periodizationType: 'none',
    sessionOrder: sessions.map((s) => s.name),
    sessions,
    modalitiesUsed: [input.modality],
    isPreset: false,
    currentSessionIndex: 0,
  };
}
