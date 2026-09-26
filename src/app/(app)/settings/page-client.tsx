'use client';
import type { Profile } from '@/contracts/domain';
import { useActiveProfile } from '@/hooks/use-repo';
import { useLocale, useTheme } from '@/components/providers';
import { SyncStatus } from '@/components/sync/sync-status';
import { AccountSection } from '@/components/settings/account-section';
import { DataSection } from '@/components/settings/data-section';
import { FamilySection } from '@/components/settings/family-section';
import { PreferencesSection, toProviderTheme } from '@/components/settings/preferences-section';
import { ProfileSection } from '@/components/settings/profile-section';
import { TrainingSection } from '@/components/settings/training-section';

export default function SettingsPage() {
  const { t, setLocale } = useLocale();
  const { setTheme } = useTheme();
  const { profile, profileId } = useActiveProfile();

  // A switched-to profile brings its own language and theme.
  const applyProfilePreferences = (p: Profile) => {
    setLocale(p.settings.language);
    setTheme(toProviderTheme(p.settings.theme));
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 bg-[var(--bg-primary)] px-4 pb-24 pt-4 text-[var(--text-primary)]">
      <h1 className="mb-2 font-display text-2xl font-semibold uppercase tracking-widest text-[var(--text-primary)]">
        {t('settings')}
      </h1>

      {profile && <ProfileSection key={`${profile.id}-${profile.settings.units}`} profile={profile} />}

      <PreferencesSection profile={profile} />

      {profile && <TrainingSection key={profile.id} profile={profile} />}

      <FamilySection activeId={profileId} onSwitched={applyProfilePreferences} />

      <AccountSection />

      <div className="mt-2">
        <SyncStatus />
      </div>

      <DataSection profileId={profileId} />
    </div>
  );
}
