'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveProfile, useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { StepFrequency, StepSplit } from '@/components/programs/builder-steps';
import { buildBuilderTemplate, type BuilderSplit } from '@/components/programs/lib/builder';
import { SPLIT_KEYS } from '@/components/programs/lib/labels';
import { todayLocal } from '@/components/programs/lib/rotation';
import { useMutationRunner } from '@/components/programs/use-program';

/**
 * Builder wizard: days → split. Picking the split persists the program
 * (inactive) right away and opens its manager with `?builder=1`, so a
 * reload or tab change never loses the draft (legacy bug B8).
 */
export default function NewProgramPage() {
  const router = useRouter();
  const { t } = useT();
  const repo = useRepo();
  const addToast = useUIStore((s) => s.addToast);
  const run = useMutationRunner(t('prog_error'));
  const { profileId } = useActiveProfile();
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(split: BuilderSplit) {
    if (!profileId || days === null || busy) return;
    setBusy(true);
    const name = t('prog_builder_default_name', { days, split: t(SPLIT_KEYS[split]) });
    const template = buildBuilderTemplate({ days, split, name, restDayName: t('prog_rest_day'), today: todayLocal() });
    let id: string | null = null;
    const ok = await run(async () => {
      id = (await repo.programs.create(profileId, template)).id;
    });
    if (!ok || !id) {
      setBusy(false);
      return;
    }
    addToast(t('prog_builder_created', { name }), 'success');
    router.replace(`/programs/${id}?builder=1`);
  }

  const step = days === null ? 1 : 2;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <button
        type="button"
        onClick={() => (days === null ? router.push('/programs') : setDays(null))}
        className="mb-4 inline-flex min-h-11 items-center gap-1 rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true">←</span> {days === null ? t('prog_builder_cancel') : t('prog_builder_back')}
      </button>

      <h1 data-testid="page-heading-program-new" className="font-display text-2xl font-bold uppercase tracking-wide text-highlight">
        {t('prog_builder_title')}
      </h1>
      <p className="mb-6 text-xs text-fg-muted">
        {t('prog_builder_step', { n: step, total: 2 })} · {step === 1 ? t('prog_builder_frequency') : t('prog_builder_split')}
      </p>

      {days === null ? <StepFrequency onPick={setDays} /> : <StepSplit days={days} busy={busy || !profileId} onPick={(s) => void create(s)} />}

      {busy ? (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-fg-muted">
          {t('prog_builder_creating')}
        </p>
      ) : null}
    </div>
  );
}
