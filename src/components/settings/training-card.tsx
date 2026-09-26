'use client';
import Link from 'next/link';
import type { Profile } from '@/contracts/domain';
import { useRepoQuery } from '@/hooks/use-repo';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { BarWeightSetting } from './bar-weight-setting';
import { RestSetting } from './rest-setting';
import { FieldLabel, SettingsCard } from './settings-section';
import { useSaveSettings } from './use-save-settings';
import { WarmupSetting } from './warmup-setting';

/** Rotation start lives on the active program; Settings only links to it. */
function RotationRow({ profileId }: { profileId: string }) {
  const { t, locale } = useT();
  const { data: program, loading } = useRepoQuery((r) => r.programs.getActive(profileId), [profileId]);
  if (loading) return null;
  return (
    <div className="space-y-1" data-testid="settings-rotation">
      <FieldLabel>{t('set_rotation_start')}</FieldLabel>
      {program ? (
        <p className="text-sm text-fg">
          {program.rotationStartDate
            ? t('set_rotation_program_since', {
                name: program.name,
                date: formatDate(new Date(`${program.rotationStartDate}T12:00:00`), locale),
              })
            : program.name}
        </p>
      ) : (
        <p className="text-sm text-fg-2">{t('set_rotation_no_program')}</p>
      )}
      <Link
        href="/programs"
        className="inline-flex min-h-11 items-center rounded text-sm text-accent-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
      >
        {t('set_rotation_manage')}
      </Link>
    </div>
  );
}

/** Rest default, warm-up strategy, bar weight and the rotation link. Saved on change. */
export function TrainingCard({ profile }: { profile: Profile }) {
  const { t } = useT();
  const save = useSaveSettings(profile);
  const { settings } = profile;

  return (
    <SettingsCard title={t('set_section_training')} testId="settings-training">
      <RestSetting value={settings.restSeconds} onChange={(restSeconds) => void save({ restSeconds })} />
      <WarmupSetting
        value={settings.warmupStrategy}
        barKg={settings.barWeightKg}
        units={settings.units}
        onChange={(warmupStrategy) => void save({ warmupStrategy })}
      />
      <BarWeightSetting
        key={`${profile.id}-${settings.units}`}
        valueKg={settings.barWeightKg}
        units={settings.units}
        onChange={(barWeightKg) => void save({ barWeightKg })}
      />
      <RotationRow profileId={profile.id} />
    </SettingsCard>
  );
}
