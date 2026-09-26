'use client';
import { useActiveProfile } from '@/hooks/use-repo';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { AppearanceCard } from '@/components/settings/appearance-card';
import { DangerZone } from '@/components/settings/danger-zone';
import { LanguageUnitsCard } from '@/components/settings/language-units-card';
import { LazyDataPanels, LazyEquipmentCard } from '@/components/settings/lazy-panels';
import { ManualSection } from '@/components/settings/manual-section';
import { ProfileEditForm } from '@/components/settings/profile-edit-form';
import { ProfilesCard } from '@/components/settings/profiles-card';
import { SettingsCard } from '@/components/settings/settings-section';
import { SyncSlot } from '@/components/settings/sync-slot';
import { TrainingCard } from '@/components/settings/training-card';

export default function SettingsPage() {
  const { t } = useT();
  const { profile, profileId, loading } = useActiveProfile();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-24 pt-4 text-fg">
      <h1 data-testid="page-heading-settings" className="font-display text-2xl font-semibold uppercase tracking-widest text-fg">
        {t('set_title')}
      </h1>

      {loading ? (
        <div role="status" aria-label={t('loading')} className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !profile ? (
        <EmptyState title={t('set_no_profile_title')} description={t('set_no_profile_desc')} />
      ) : (
        <>
          <ProfilesCard activeId={profileId} />
          <ProfileEditForm key={`${profile.id}-${profile.settings.units}`} profile={profile} />
          <LanguageUnitsCard profile={profile} />
          <TrainingCard profile={profile} />
          <AppearanceCard profile={profile} />
          <LazyEquipmentCard profile={profile} />
          <SettingsCard title={t('set_section_data')} testId="settings-data">
            <LazyDataPanels profile={profile} />
          </SettingsCard>
          <SyncSlot />
          <DangerZone />
          <ManualSection />
        </>
      )}
    </div>
  );
}
