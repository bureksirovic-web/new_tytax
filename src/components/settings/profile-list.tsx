'use client';
import type { Profile } from '@/contracts/domain';
import { Badge, Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';

export interface ProfileRow {
  profile: Profile;
  workouts: number;
}

interface ProfileListProps {
  rows: readonly ProfileRow[];
  activeId: string | undefined;
  busy: boolean;
  onSwitch: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
}

/** Profile rows: name, badges, workout count, switch and delete. */
export function ProfileList({ rows, activeId, busy, onSwitch, onDelete }: ProfileListProps) {
  const { t } = useT();
  const last = rows.length <= 1;

  return (
    <ul className="space-y-2" data-testid="settings-profile-list">
      {rows.map(({ profile: p, workouts }) => {
        const isActive = p.id === activeId;
        const accountBlocked = Boolean(p.accountId);
        const blockedReason = last
          ? t('set_profile_delete_last_blocked')
          : accountBlocked
            ? t('set_profile_account_delete_blocked')
            : undefined;
        const reasonId = `settings-profile-block-${p.id}`;
        return (
          <li
            key={p.id}
            data-testid={`settings-profile-row-${p.id}`}
            className={`rounded-lg border px-3 py-2 ${isActive ? 'border-od-green-600 bg-card' : 'border-line bg-card'}`}
          >
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-fg">{p.name}</span>
                  {isActive && <Badge variant="success">{t('set_profile_current')}</Badge>}
                  {accountBlocked && <Badge>{t('set_profile_account_badge')}</Badge>}
                </p>
                <p className="text-xs text-fg-muted">{t('set_profile_workouts', { n: workouts })}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isActive && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-label={t('set_profile_switch_aria', { name: p.name })}
                    data-testid={`settings-profile-switch-${p.id}`}
                    onClick={() => onSwitch(p)}
                  >
                    {t('set_profile_switch')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-300"
                  disabled={busy || blockedReason !== undefined}
                  aria-label={t('set_profile_delete_aria', { name: p.name })}
                  aria-describedby={blockedReason ? reasonId : undefined}
                  data-testid={`settings-profile-delete-${p.id}`}
                  onClick={() => onDelete(p)}
                >
                  {t('delete')}
                </Button>
              </div>
            </div>
            {blockedReason && (
              <p id={reasonId} className="text-xs text-fg-muted">
                {blockedReason}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
