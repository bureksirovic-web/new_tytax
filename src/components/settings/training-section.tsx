'use client';
import { useState } from 'react';
import type { Profile, WarmupStrategy } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button, Input } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { ChoiceChips, Section, SectionTitle, type Choice } from './settings-section';
import { parseNonNegative } from './units';

const WARMUP_STRATEGIES: readonly WarmupStrategy[] = ['standard', 'heavy', 'pyramid', 'none'];

/**
 * Default rest, warm-up strategy and bar weight of the active profile.
 * Remount with `key={profile.id}` on a profile switch.
 */
export function TrainingSection({ profile }: { profile: Profile }) {
  const { t } = useLocale();
  const repo = useRepo();
  const { settings } = profile;
  const [rest, setRest] = useState(String(settings.restSeconds));
  const [bar, setBar] = useState(String(settings.barWeightKg));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const restValue = parseNonNegative(rest);
  const barValue = parseNonNegative(bar);
  const restValid = typeof restValue === 'number' && Number.isInteger(restValue);
  const barValid = typeof barValue === 'number';

  // i18n: strategy labels requested in docs/v2/requests/G1-i18n.md; the enum value shows meanwhile.
  const warmupChoices: Choice<WarmupStrategy>[] = WARMUP_STRATEGIES.map((s) => ({ value: s, label: s }));

  async function run(patch: Partial<Profile['settings']>) {
    setSaving(true);
    setFailed(false);
    try {
      await repo.profiles.updateSettings(profile.id, patch);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section testId="settings-training">
      <SectionTitle>{t('sidebar_training')}</SectionTitle>
      <div>
        <p className="mb-2 font-display text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {t('warmup_sets')}
        </p>
        <ChoiceChips
          name="warmupStrategy"
          choices={warmupChoices}
          value={settings.warmupStrategy}
          onChange={(warmupStrategy) => void run({ warmupStrategy })}
        />
      </div>
      <Input
        label={t('workout_rest_timer')}
        type="text"
        inputMode="numeric"
        value={rest}
        onChange={(e) => setRest(e.target.value)}
        error={restValid ? undefined : t('error')}
      />
      <Input
        label={t('workout_weight_kg')}
        type="text"
        inputMode="decimal"
        value={bar}
        onChange={(e) => setBar(e.target.value)}
        error={barValid ? undefined : t('error')}
      />
      {failed && <p className="text-xs text-red-400">{t('error')}</p>}
      <Button
        size="sm"
        loading={saving}
        disabled={!restValid || !barValid}
        onClick={() => {
          if (typeof restValue === 'number' && typeof barValue === 'number') {
            void run({ restSeconds: restValue, barWeightKg: barValue });
          }
        }}
      >
        {t('save')}
      </Button>
    </Section>
  );
}
