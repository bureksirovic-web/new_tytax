'use client';
import type { Language, Profile, ThemeName, Units } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { useLocale, useTheme } from '@/components/providers';
import { LOCALES } from '@/lib/i18n';
import { ChoiceChips, Section, SectionTitle, type Choice } from './settings-section';

/** The theme provider calls the tactical theme 'dark'. */
type ProviderTheme = 'dark' | 'oled';
export const toProviderTheme = (theme: ThemeName): ProviderTheme => (theme === 'oled' ? 'oled' : 'dark');
const toThemeName = (theme: ProviderTheme): ThemeName => (theme === 'oled' ? 'oled' : 'tactical');

const LANGUAGES: readonly Language[] = ['hr', 'en'];

/**
 * Units, language and theme. Each change updates the provider (so the UI
 * reacts at once) and persists to the active profile's settings.
 */
export function PreferencesSection({ profile }: { profile: Profile | undefined }) {
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  const repo = useRepo();

  const persist = (patch: Partial<Profile['settings']>) => {
    if (!profile) return;
    repo.profiles.updateSettings(profile.id, patch).catch((error: unknown) => {
      console.error('[settings] could not save settings', error);
    });
  };

  const unitChoices: Choice<Units>[] = [
    { value: 'kg', label: t('units_metric') },
    { value: 'lb', label: t('units_imperial') },
  ];
  const languageChoices: Choice<Language>[] = LANGUAGES.map((code) => ({ value: code, label: LOCALES[code] }));
  const themeChoices: Choice<ProviderTheme>[] = [
    { value: 'dark', label: t('theme_dark') },
    { value: 'oled', label: t('theme_oled') },
  ];

  return (
    <>
      <Section testId="settings-units">
        <SectionTitle>{t('units')}</SectionTitle>
        <ChoiceChips
          name="units"
          choices={unitChoices}
          value={profile?.settings.units}
          disabled={!profile}
          onChange={(units) => persist({ units })}
        />
      </Section>

      <Section testId="settings-language">
        <SectionTitle>{t('language')}</SectionTitle>
        <ChoiceChips
          name="locale"
          choices={languageChoices}
          value={locale}
          onChange={(language) => {
            setLocale(language);
            persist({ language });
          }}
        />
      </Section>

      <Section testId="settings-theme">
        <SectionTitle>{t('theme')}</SectionTitle>
        <ChoiceChips
          name="theme"
          choices={themeChoices}
          value={theme}
          onChange={(th) => {
            setTheme(th);
            persist({ theme: toThemeName(th) });
          }}
        />
      </Section>
    </>
  );
}
