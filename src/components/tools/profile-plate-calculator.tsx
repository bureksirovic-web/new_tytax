'use client';
import { useLocale } from '@/components/providers';
import { useActiveProfile } from '@/hooks/use-repo';
import { PlateCalculator } from './plate-calculator';
import { DEFAULT_BAR_KG, DEFAULT_PLATES_KG } from './plate-math';

function validBar(kg: number | undefined): kg is number {
  return typeof kg === 'number' && Number.isFinite(kg) && kg >= 0;
}

function validPlates(plates: readonly number[] | undefined): plates is readonly number[] {
  return Array.isArray(plates) && plates.some((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
}

/**
 * Plate calculator seeded from the active profile: bar weight from
 * `settings.barWeightKg`, plate sizes from `settings.plateSetKg`; falls back
 * to 20 kg and the standard set when there is no profile or the value is unusable.
 * Renders once the profile query settles so the initial values are final.
 */
export function ProfilePlateCalculator() {
  const { t } = useLocale();
  const { profile, loading } = useActiveProfile();
  if (loading) {
    return (
      <p data-testid="plate-loading" className="py-6 text-center text-sm text-[var(--text-muted)]">
        {t('loading')}
      </p>
    );
  }
  const settings = profile?.settings;
  const bar = validBar(settings?.barWeightKg) ? settings.barWeightKg : DEFAULT_BAR_KG;
  const plates = validPlates(settings?.plateSetKg) ? settings.plateSetKg : DEFAULT_PLATES_KG;
  return <PlateCalculator key={profile?.id ?? 'none'} initialBarKg={bar} platesKg={plates} />;
}
