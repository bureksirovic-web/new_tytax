'use client';
import type { MachineSetup } from '@/contracts/domain';
import { SETUP_FIELDS } from '@/stores/setup-adapter';
import { useSetupStrings } from './strings/setup';

export interface SetupSummaryProps {
  setup: MachineSetup;
}

/** The filled machine-setup fields of an exercise card ("Seat 4 · Pin 7"). Empty setup: nothing. */
export function SetupSummary({ setup }: SetupSummaryProps) {
  const t = useSetupStrings();
  const filled = SETUP_FIELDS.filter((field) => (setup[field] ?? '').trim() !== '');
  if (filled.length === 0) return null;
  return (
    <dl
      data-testid="exercise-setup"
      aria-label={t('setup_label')}
      className="mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-sm"
    >
      {filled.map((field) => (
        <div key={field} data-testid={`exercise-setup-${field}`} className="flex min-w-0 gap-1">
          <dt className="text-[var(--text-muted)]">{t(`setup_${field}`)}</dt>
          <dd className="break-words font-mono text-[var(--text-primary)]">{setup[field]}</dd>
        </div>
      ))}
    </dl>
  );
}
