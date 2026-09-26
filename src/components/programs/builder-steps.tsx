'use client';
import type { Modality, ProgramSession, SplitType } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/components/providers';
import { FREQ_OPTIONS, MODALITY_OPTIONS, SPLIT_OPTIONS } from './program-builder';

function OptionButton({
  selected,
  onClick,
  className = '',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[52px] rounded-xl border text-sm font-medium transition-colors ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
          : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-display text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{children}</p>
  );
}

export function StepNameModality(props: {
  name: string;
  modality: Modality;
  onName: (name: string) => void;
  onModality: (m: Modality) => void;
  onNext: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-5">
      <Input
        label={t('program_name')}
        value={props.name}
        onChange={(e) => props.onName(e.target.value)}
        placeholder={t('program_name_placeholder')}
        autoFocus
      />
      <div>
        <FieldLabel>{t('primary_modality')}</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {MODALITY_OPTIONS.map((opt) => (
            <OptionButton key={opt.value} selected={props.modality === opt.value} onClick={() => props.onModality(opt.value)} className="px-4 py-3">
              {t(opt.labelKey)}
            </OptionButton>
          ))}
        </div>
      </div>
      <Button fullWidth variant="primary" size="lg" disabled={!props.name.trim()} onClick={props.onNext}>
        {t('next')}
      </Button>
    </div>
  );
}

export function StepStructure(props: {
  split: SplitType;
  frequency: number;
  onSplit: (split: SplitType, minDays: number) => void;
  onFrequency: (f: number) => void;
  onNext: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>{t('split_type')}</FieldLabel>
        <div className="flex flex-col gap-2">
          {SPLIT_OPTIONS.map((opt) => (
            <OptionButton key={opt.value} selected={props.split === opt.value} onClick={() => props.onSplit(opt.value, opt.minDays)} className="px-4 py-3 text-left">
              {t(opt.labelKey)}
            </OptionButton>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>
          {t('frequency')} ({t('days_per_week')})
        </FieldLabel>
        <div className="flex gap-2">
          {FREQ_OPTIONS.map((f) => (
            <OptionButton key={f} selected={props.frequency === f} onClick={() => props.onFrequency(f)} className="flex-1 py-3 font-semibold">
              {f}
            </OptionButton>
          ))}
        </div>
      </div>
      <Button fullWidth variant="primary" size="lg" onClick={props.onNext}>
        {t('review')}
      </Button>
    </div>
  );
}

export function StepReview(props: {
  name: string;
  modality: Modality;
  split: SplitType;
  frequency: number;
  sessions: readonly ProgramSession[];
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <p className="font-display text-lg font-bold uppercase text-[var(--highlight)]">{props.name}</p>
        <p className="mb-4 mt-1 text-xs text-[var(--text-muted)]">
          {props.modality} &middot; {props.split.replace(/_/g, ' ')} &middot; {props.frequency} {t('days_per_week')}
        </p>
        <div className="flex flex-col gap-2">
          {props.sessions.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 border-t border-[var(--border-color)] py-2">
              <span className="w-6 text-center text-xs font-semibold text-[var(--text-muted)]">{i + 1}</span>
              <span className="text-sm text-[var(--text-secondary)]">{s.name}</span>
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {s.exercises.length} {t('exercise_plural')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{t('sessions_empty_note')}</p>
      <Button fullWidth variant="primary" size="lg" loading={props.saving} onClick={props.onSave}>
        {t('save_program')}
      </Button>
    </div>
  );
}
