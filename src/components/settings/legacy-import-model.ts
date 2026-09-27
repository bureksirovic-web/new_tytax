import type { Profile } from '@/contracts/domain';
import type { LegacyImportOptions, LegacyUserPreview } from './legacy-import-api';
import { validateProfileName, type NameProblem } from './settings-utils';

/** Per legacy user: `new` (create a profile named `name`), `skip`, or an existing profile's id. */
export type TargetChoice = { kind: 'new'; name: string } | { kind: 'skip' } | { kind: 'existing'; profileId: string };

export type Choices = Record<string, TargetChoice>;

/** Default: a new profile named after the legacy user. */
export function defaultChoices(users: readonly LegacyUserPreview[]): Choices {
  return Object.fromEntries(users.map((u) => [u.username, { kind: 'new', name: u.username } as TargetChoice]));
}

export type MappingProblem = 'nothing' | 'same_profile';

export interface MappingCheck {
  /** Name problem per username with a `new` target. */
  names: Record<string, NameProblem>;
  problem: MappingProblem | null;
  options: LegacyImportOptions | null;
}

/**
 * Turns the choices into G2's `importLegacy` options, or reports why it cannot:
 * no user selected, two users into one existing profile, or an invalid/duplicate
 * new profile name (checked against local profiles and the other new names).
 */
export function checkMapping(users: readonly LegacyUserPreview[], choices: Choices, profiles: readonly Profile[]): MappingCheck {
  const names: Record<string, NameProblem> = {};
  const taken = new Set<string>();
  const newNames: string[] = [];
  let problem: MappingProblem | null = null;
  const selected: LegacyImportOptions['users'][number][] = [];
  for (const { username } of users) {
    const choice = choices[username] ?? { kind: 'skip' };
    if (choice.kind === 'skip') continue;
    if (choice.kind === 'existing') {
      if (taken.has(choice.profileId)) problem = 'same_profile';
      taken.add(choice.profileId);
      selected.push({ username, target: { profileId: choice.profileId } });
      continue;
    }
    const name = choice.name.trim();
    const lower = name.toLocaleLowerCase();
    const nameProblem =
      validateProfileName(name, profiles) ?? (newNames.includes(lower) ? ('taken' as const) : null);
    if (nameProblem) names[username] = nameProblem;
    newNames.push(lower);
    selected.push({ username, target: { createProfileName: name } });
  }
  if (selected.length === 0) problem = 'nothing';
  const ok = problem === null && Object.keys(names).length === 0;
  return { names, problem, options: ok ? { users: selected } : null };
}

/** Choice ↔ `<select>` value: 'new', 'skip' or 'p:<profileId>'. */
export const choiceValue = (c: TargetChoice): string => (c.kind === 'existing' ? `p:${c.profileId}` : c.kind);

export function choiceFromValue(value: string, username: string, previous: TargetChoice): TargetChoice {
  if (value.startsWith('p:')) return { kind: 'existing', profileId: value.slice(2) };
  if (value === 'skip') return { kind: 'skip' };
  return { kind: 'new', name: previous.kind === 'new' ? previous.name : username };
}
