'use client';
import { useState } from 'react';
import type { Profile, Units } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button, Input } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { SelectField } from './settings-section';
import { notify, PROFILE_NAME_MAX, validateProfileName, type NameProblem } from './settings-utils';
import '@/lib/i18n/packs/settings';

const PROBLEM_KEY = {
  required: 'set_profile_name_required',
  too_long: 'set_profile_name_too_long',
  taken: 'set_profile_name_taken',
} as const satisfies Record<NameProblem, string>;

/**
 * Creates a family profile (name + units). Activating it is the parent's job
 * (`onCreated`), so the switch goes through the same workout-in-progress warning.
 */
export function ProfileCreateForm({
  profiles,
  onCreated,
}: {
  profiles: readonly Profile[];
  onCreated: (profile: Profile) => void;
}) {
  const { t, locale } = useT();
  const repo = useRepo();
  const [name, setName] = useState('');
  const [units, setUnits] = useState<Units>('kg');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const problem = validateProfileName(name, profiles);
  const showProblem = touched && problem !== null;

  async function submit() {
    setTouched(true);
    if (problem || busy) return;
    setBusy(true);
    try {
      const created = await repo.profiles.create({ name: name.trim(), settings: { units, language: locale } });
      setName('');
      setTouched(false);
      notify(t('set_profile_created', { name: created.name }));
      onCreated(created);
    } catch (error: unknown) {
      console.error('[settings] create profile failed', error);
      notify(t('set_action_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-dashed border-line p-3"
      aria-label={t('set_profile_add')}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm font-medium text-fg">{t('set_profile_add')}</p>
      <Input
        label={t('set_profile_name')}
        placeholder={t('set_profile_name_placeholder')}
        value={name}
        maxLength={PROFILE_NAME_MAX + 10}
        data-testid="settings-profile-name-input"
        error={showProblem && problem ? t(PROBLEM_KEY[problem]) : undefined}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched(name !== '')}
      />
      <SelectField<Units>
        label={t('set_units')}
        value={units}
        options={[
          { value: 'kg', label: t('set_units_kg') },
          { value: 'lb', label: t('set_units_lb') },
        ]}
        onChange={setUnits}
      />
      <Button type="submit" size="md" loading={busy} disabled={busy} data-testid="settings-profile-create">
        {t('set_profile_create')}
      </Button>
    </form>
  );
}
