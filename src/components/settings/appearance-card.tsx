'use client';
import type { Profile } from '@/contracts/domain';
import { useTheme } from '@/components/providers';
import { useT } from '@/lib/i18n/use-t';
import { useSaveSettings } from './use-save-settings';
import { SettingsCard, SwitchRow } from './settings-section';

/** OLED pure black: applied through the theme provider and saved on the profile. */
export function AppearanceCard({ profile }: { profile: Profile }) {
  const { t } = useT();
  const { theme, setTheme } = useTheme();
  const save = useSaveSettings(profile);
  // Reflect what is on screen (the provider), so the switch never contradicts the page.
  const oled = theme === 'oled';

  return (
    <SettingsCard title={t('set_section_appearance')} testId="settings-appearance">
      <SwitchRow
        label={t('set_oled')}
        hint={t('set_oled_hint')}
        checked={oled}
        testId="settings-oled"
        onChange={(on) => {
          setTheme(on ? 'oled' : 'dark');
          void save({ theme: on ? 'oled' : 'tactical' });
        }}
      />
    </SettingsCard>
  );
}
