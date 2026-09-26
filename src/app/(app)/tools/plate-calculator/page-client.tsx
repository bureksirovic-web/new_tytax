'use client';
import { ProfilePlateCalculator } from '@/components/tools/profile-plate-calculator';
import { useToolsT } from '@/components/tools/tools-i18n';

export default function PlateCalculatorPage() {
  const t = useToolsT();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1
        data-testid="page-heading-plate-calculator"
        className="font-[family-name:var(--font-display)] text-2xl uppercase text-[var(--text-primary)]"
      >
        {t('plate_title')}
      </h1>
      <p className="text-sm text-[var(--text-muted)]">{t('plate_desc')}</p>
      <ProfilePlateCalculator />
    </div>
  );
}
