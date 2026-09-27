'use client';
import { useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo, useRepoQuery } from '@/hooks/use-repo';
import { Button, Input } from '@/components/ui';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { SettingsCard } from './settings-section';
import { localDay, notify, parseDecimal, PROFILE_NAME_MAX, validateProfileName, type NameProblem } from './settings-utils';

const NAME_PROBLEM_KEY = {
  required: 'set_profile_name_required',
  too_long: 'set_profile_name_too_long',
  taken: 'set_profile_name_taken',
} as const satisfies Record<NameProblem, string>;

/**
 * Name and bodyweight of the active profile. Bodyweight is entered in the
 * display unit, stored in kg, and upserted as today's bodyweight entry (the
 * same log Analytics reads). Remount with `key` on profile or unit change.
 */
export function ProfileEditForm({ profile }: { profile: Profile }) {
  const { t } = useT();
  const repo = useRepo();
  const units = profile.settings.units;
  const { data: others } = useRepoQuery((r) => r.profiles.list(), []);
  const [name, setName] = useState(profile.name);
  const [bw, setBw] = useState(profile.bodyweightKg != null ? String(toDisplayWeight(profile.bodyweightKg, units)) : '');
  const [saving, setSaving] = useState(false);

  const nameProblem = validateProfileName(name, others ?? [], profile.id);
  const parsedBw = parseDecimal(bw);
  const bwValid = parsedBw === null || (parsedBw !== undefined && parsedBw > 0 && parsedBw < 1000);
  const valid = nameProblem === null && bwValid;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      // Untouched text is the stored kg rounded for display (80 kg → 176.4 lb → 80.01 kg):
      // keep the stored value so a rename never writes a drifted bodyweight entry.
      const unchanged = profile.bodyweightKg != null && parsedBw === toDisplayWeight(profile.bodyweightKg, units);
      const kg = typeof parsedBw === 'number' && !unchanged ? fromDisplayWeight(parsedBw, units) : undefined;
      if (kg !== undefined && kg !== profile.bodyweightKg) {
        const today = localDay();
        const [entry] = await repo.bodyweight.list(profile.id, { from: today, to: today });
        if (entry) await repo.bodyweight.update(profile.id, entry.id, { valueKg: kg });
        else await repo.bodyweight.add(profile.id, { date: today, valueKg: kg });
      }
      // An emptied field clears the profile's bodyweight; past bodyweight entries stay in the log.
      const bodyweightKg = parsedBw === null ? undefined : (kg ?? profile.bodyweightKg);
      await repo.profiles.update(profile.id, { name: name.trim(), bodyweightKg });
      notify(t('set_profile_saved'));
    } catch (error: unknown) {
      console.error('[settings] save profile failed', error);
      notify(t('set_action_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title={t('set_profile_edit')} testId="settings-profile-edit">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          label={t('set_profile_name')}
          value={name}
          maxLength={PROFILE_NAME_MAX + 10}
          data-testid="settings-profile-edit-name"
          error={nameProblem ? t(NAME_PROBLEM_KEY[nameProblem]) : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('set_profile_bodyweight', { unit: units })}
          inputMode="decimal"
          value={bw}
          data-testid="settings-profile-edit-bodyweight"
          error={bwValid ? undefined : t('set_invalid_number')}
          onChange={(e) => setBw(e.target.value)}
        />
        <Button type="submit" size="sm" loading={saving} disabled={!valid}>
          {t('save')}
        </Button>
      </form>
    </SettingsCard>
  );
}
