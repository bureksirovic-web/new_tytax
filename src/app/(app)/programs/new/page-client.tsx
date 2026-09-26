'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Modality, SplitType } from '@/contracts/domain';
import { useActiveProfile, useRepo } from '@/hooks/use-repo';
import { useLocale } from '@/components/providers';
import { StepNameModality, StepReview, StepStructure } from '@/components/programs/builder-steps';
import { buildProgramTemplate, generateSessions } from '@/components/programs/program-builder';

type Step = 1 | 2 | 3;
const STEPS: readonly Step[] = [1, 2, 3];

export default function NewProgramPage() {
  const router = useRouter();
  const { t } = useLocale();
  const repo = useRepo();
  const { profileId } = useActiveProfile();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [modality, setModality] = useState<Modality>('custom');
  const [split, setSplit] = useState<SplitType>('full_body');
  const [frequency, setFrequency] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  const previewSessions = useMemo(() => generateSessions(split, frequency), [split, frequency]);

  async function handleSave() {
    if (!name.trim() || !profileId || saving) return;
    setSaving(true);
    try {
      const template = buildProgramTemplate({ name, modality, split, frequency });
      const created = await repo.programs.create(profileId, template);
      router.push(`/programs/${created.id}`);
    } finally {
      setSaving(false);
    }
  }

  const stepTitles: Record<Step, string> = {
    1: t('name_modality'),
    2: t('structure'),
    3: t('review'),
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <button
        onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.push('/programs'))}
        className="mb-4 flex min-h-[44px] items-center gap-1 text-xs text-[var(--text-muted)]"
      >
        ← {step > 1 ? t('back') : t('programs')}
      </button>

      <div className="mb-6 flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'}`}
          />
        ))}
      </div>

      <h1 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-[var(--highlight)]">
        {t('new_program_page')}
      </h1>
      <p className="mb-6 text-xs text-[var(--text-muted)]">
        {t('step_of')} {step} {t('of')} {STEPS.length} — {stepTitles[step]}
      </p>

      {step === 1 && (
        <StepNameModality name={name} modality={modality} onName={setName} onModality={setModality} onNext={() => setStep(2)} />
      )}

      {step === 2 && (
        <StepStructure
          split={split}
          frequency={frequency}
          onSplit={(value, minDays) => {
            setSplit(value);
            if (frequency < minDays) setFrequency(minDays);
          }}
          onFrequency={setFrequency}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepReview
          name={name}
          modality={modality}
          split={split}
          frequency={frequency}
          sessions={previewSessions}
          saving={saving || !profileId}
          onSave={() => void handleSave()}
        />
      )}
    </div>
  );
}
