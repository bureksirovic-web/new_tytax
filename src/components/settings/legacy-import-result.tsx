'use client';
import type { Profile } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import type { LegacyImportCounts, LegacyImportResult, LegacyUserResult } from './legacy-import-api';
import type { Choices } from './legacy-import-model';
import '@/lib/i18n/packs/settings';

type CountKey = 'set_legacy_result_logs' | 'set_legacy_result_bw' | 'set_legacy_result_programs';

/** Per-user outcome of an import, announced as a status region. */
export function LegacyImportResultView({
  result,
  choices,
  profiles,
}: {
  result: LegacyImportResult;
  choices: Choices;
  profiles: readonly Profile[];
}) {
  const { t } = useT();
  const unresolved = result.unresolvedCount ?? result.unresolved.length;
  const counts = (key: CountKey, c: LegacyImportCounts) => t(key, { inserted: c.inserted, updated: c.updated, skipped: c.skipped });
  const describe = (u: LegacyUserResult) => {
    const choice = choices[u.username];
    const profile =
      choice?.kind === 'new' ? choice.name.trim() : (profiles.find((p) => p.id === u.profileId)?.name ?? u.profileId);
    return {
      heading: t(u.createdProfile ? 'set_legacy_result_new' : 'set_legacy_result_existing', { user: u.username, profile }),
      lines: [
        counts('set_legacy_result_logs', u.logs),
        counts('set_legacy_result_bw', u.bodyweight),
        counts('set_legacy_result_programs', u.programs),
        ...(u.activatedProgramId !== null ? [t('set_legacy_result_activated')] : []),
      ],
    };
  };

  return (
    <div role="status" className="space-y-3" data-testid="settings-legacy-result">
      <p className="font-semibold text-fg">{t('set_legacy_done')}</p>
      <ul className="space-y-3">
        {result.perUser.map((u) => {
          const { heading, lines } = describe(u);
          return (
            <li key={u.username} className="space-y-1 text-sm text-fg-2" data-testid={`legacy-result-${u.username}`}>
              <p className="font-medium text-fg">{heading}</p>
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </li>
          );
        })}
      </ul>
      {unresolved > 0 && <p className="text-sm text-fg-muted">{t('set_legacy_unresolved', { n: unresolved })}</p>}
    </div>
  );
}
