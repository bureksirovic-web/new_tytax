'use client';
import { useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button, Input } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { Section, SectionTitle } from './settings-section';
import { kgToUnits, parseNonNegative, unitsToKg } from './units';

/** Name and bodyweight of the active profile. Remount with `key={profile.id}` on a profile switch. */
export function ProfileSection({ profile }: { profile: Profile }) {
  const { t } = useLocale();
  const repo = useRepo();
  const units = profile.settings.units;
  const [name, setName] = useState(profile.name);
  const [bodyweight, setBodyweight] = useState(
    profile.bodyweightKg != null ? String(kgToUnits(profile.bodyweightKg, units)) : '',
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const parsedBw = parseNonNegative(bodyweight);
  // Bodyweight is optional, but when given it must be > 0 (the repository rejects 0).
  const bwValid = parsedBw === null || (parsedBw !== undefined && parsedBw > 0);
  const valid = name.trim() !== '' && bwValid;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setFailed(false);
    try {
      await repo.profiles.update(profile.id, {
        name: name.trim(),
        bodyweightKg: parsedBw ? unitsToKg(parsedBw, units) : undefined,
      });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section testId="settings-profile">
      <SectionTitle>{t('profile')}</SectionTitle>
      <Input
        label={t('display_name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('display_name_placeholder')}
      />
      <Input
        label={`${t('bodyweight')} (${units})`}
        type="text"
        inputMode="decimal"
        value={bodyweight}
        onChange={(e) => setBodyweight(e.target.value)}
        placeholder={t('bodyweight_placeholder')}
        error={bwValid ? undefined : t('error')}
      />
      {failed && <p className="text-xs text-red-400">{t('error')}</p>}
      <Button onClick={() => void save()} loading={saving} disabled={!valid} size="sm">
        {t('save')}
      </Button>
    </Section>
  );
}
