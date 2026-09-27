'use client';
import type { Language, Profile, Units } from '@/contracts/domain';
import { LOCALES } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { Hint, SelectField, SettingsCard } from './settings-section';
import { useSaveSettings } from './use-save-settings';
import '@/lib/i18n/packs/settings';

const LANGUAGES: readonly Language[] = ['hr', 'en'];

/** Language (applied immediately and saved on the profile) and weight units. */
export function LanguageUnitsCard({ profile }: { profile: Profile }) {
  const { t, locale, setLocale } = useT();
  const save = useSaveSettings(profile);

  return (
    <SettingsCard title={t('set_section_language_units')} testId="settings-language-units">
      <SelectField<Language>
        label={t('set_language')}
        // Shows the language the UI is actually in: if the stored profile language and the
        // UI ever disagree, picking the shown-but-inactive language must still fire a change.
        value={locale}
        testId="settings-language-select"
        // Endonyms: each language is named in itself.
        options={LANGUAGES.map((code) => ({ value: code, label: LOCALES[code] }))}
        onChange={(language) => {
          setLocale(language);
          void save({ language });
        }}
      />
      <SelectField<Units>
        label={t('set_units')}
        value={profile.settings.units}
        testId="settings-units-select"
        options={[
          { value: 'kg', label: t('set_units_kg') },
          { value: 'lb', label: t('set_units_lb') },
        ]}
        onChange={(units) => void save({ units })}
      />
      <Hint>{t('set_units_hint')}</Hint>
    </SettingsCard>
  );
}
