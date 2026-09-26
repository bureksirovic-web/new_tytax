'use client';
import type { Profile } from '@/contracts/domain';
import { Input } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import type { LegacyServiceWarning, LegacyUserPreview } from './legacy-import-api';
import { choiceFromValue, choiceValue, type TargetChoice } from './legacy-import-model';
import { SelectField } from './settings-section';
import { PROFILE_NAME_MAX, type NameProblem } from './settings-utils';

const NAME_PROBLEM_KEY = {
  required: 'set_profile_name_required',
  too_long: 'set_profile_name_too_long',
  taken: 'set_profile_name_taken',
} as const satisfies Record<NameProblem, string>;

const summaryClass =
  'flex min-h-11 cursor-pointer items-center rounded-lg text-sm text-fg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Expandable list of warnings (`code` + `path`). */
export function WarningList({ label, warnings, testId }: { label: string; warnings: readonly LegacyServiceWarning[]; testId: string }) {
  if (warnings.length === 0) return null;
  return (
    <details data-testid={testId}>
      <summary className={summaryClass}>{label}</summary>
      <ul className="max-h-40 space-y-1 overflow-y-auto pl-2 text-xs text-fg-muted">
        {warnings.map((w, i) => (
          <li key={i}>
            <span className="font-mono text-fg-2">{w.code}</span> <span className="break-all">{w.path}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface LegacyUserRowProps {
  user: LegacyUserPreview;
  choice: TargetChoice;
  profiles: readonly Profile[];
  nameProblem?: NameProblem;
  disabled: boolean;
  onChange: (choice: TargetChoice) => void;
}

/** One legacy user in the preview: counts, unresolved names, warnings and where to import it. */
export function LegacyUserRow({ user, choice, profiles, nameProblem, disabled, onChange }: LegacyUserRowProps) {
  const { t } = useT();
  const unresolvedTotal = user.unresolvedCount ?? user.unresolved.length;
  const hidden = unresolvedTotal - user.unresolved.length;
  const options = [
    { value: 'new', label: t('set_legacy_target_new') },
    ...profiles.map((p) => ({ value: `p:${p.id}`, label: t('set_legacy_target_existing', { name: p.name }) })),
    { value: 'skip', label: t('set_legacy_target_skip') },
  ];

  return (
    <li className="space-y-2 rounded-lg border border-line p-3" data-testid={`legacy-user-${user.username}`}>
      <p className="font-semibold text-fg">{user.username}</p>
      <p className="text-sm text-fg-2">
        {t('set_legacy_counts', { logs: user.logs, sets: user.sets, bw: user.bodyweight, programs: user.programs })}
      </p>
      {unresolvedTotal > 0 && (
        <details data-testid={`legacy-unresolved-${user.username}`}>
          <summary className={summaryClass}>{t('set_legacy_unresolved_count', { n: unresolvedTotal })}</summary>
          <ul className="max-h-40 space-y-1 overflow-y-auto pl-2 text-xs text-fg-muted">
            {user.unresolved.map((u) => (
              <li key={u.legacyName}>
                {u.legacyName} <span className="text-fg-2">×{u.occurrences}</span>
              </li>
            ))}
            {hidden > 0 && <li>{t('set_legacy_unresolved_more', { n: hidden })}</li>}
          </ul>
        </details>
      )}
      <WarningList
        label={t('set_legacy_warnings', { n: user.warnings.length })}
        warnings={user.warnings}
        testId={`legacy-warnings-${user.username}`}
      />
      <SelectField
        label={t('set_legacy_target', { user: user.username })}
        value={choiceValue(choice)}
        options={options}
        disabled={disabled}
        testId={`legacy-target-${user.username}`}
        onChange={(v) => onChange(choiceFromValue(v, user.username, choice))}
      />
      {choice.kind === 'new' && (
        <Input
          label={t('set_legacy_new_name')}
          value={choice.name}
          maxLength={PROFILE_NAME_MAX}
          autoComplete="off"
          disabled={disabled}
          error={nameProblem ? t(NAME_PROBLEM_KEY[nameProblem]) : undefined}
          data-testid={`legacy-name-${user.username}`}
          onChange={(e) => onChange({ kind: 'new', name: e.target.value })}
        />
      )}
    </li>
  );
}
