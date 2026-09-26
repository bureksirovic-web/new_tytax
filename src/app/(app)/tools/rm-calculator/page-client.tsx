'use client';
import { RmCalculator } from '@/components/tools/rm-calculator';
import { useToolsT } from '@/components/tools/tools-i18n';

export default function RmCalculatorPage() {
  const t = useToolsT();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1
        data-testid="page-heading-rm-calculator"
        className="font-[family-name:var(--font-display)] text-2xl uppercase text-[var(--text-primary)]"
      >
        {t('rm_title')}
      </h1>
      <p className="text-sm text-[var(--text-muted)]">{t('rm_desc')}</p>
      <RmCalculator />
    </div>
  );
}
