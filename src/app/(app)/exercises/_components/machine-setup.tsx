'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRepoQuery } from '@/hooks/use-repo';
import { getRepository } from '@/lib/db';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { SectionCard } from './section-card';
import { SETUP_FIELDS, SETUP_MAX, normalizeSetup, sameSetup, setupWriter, toDraft, type SetupDraft, type SetupField } from './setup-adapter';
import '@/lib/i18n/packs/exercises';

const FIELD_KEYS: Record<SetupField, TranslationKey> = {
  seat: 'ex_setup_seat',
  pin: 'ex_setup_pin',
  backrest: 'ex_setup_backrest',
  benchAngle: 'ex_setup_bench_angle',
  cable: 'ex_setup_cable',
  other: 'ex_setup_other',
};

const inputCls =
  'min-h-11 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-od-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-od-green-500/50 disabled:opacity-60';

interface MachineSetupProps {
  exerciseId: string;
  exerciseName: string;
  profileId: string | undefined;
}

/** Per-profile machine setup (seat, pin, backrest, bench angle, cable, other) for one exercise. */
export function MachineSetupEditor({ exerciseId, exerciseName, profileId }: MachineSetupProps) {
  const { t } = useT();
  const baseId = useId();
  const addToast = useUIStore((s) => s.addToast);
  const { data: note, loading } = useRepoQuery(
    (repo) => (profileId ? repo.notes.get(profileId, exerciseId) : Promise.resolve(undefined)),
    [profileId, exerciseId],
  );
  const writer = setupWriter(getRepository().notes);
  const owner = `${profileId ?? ''}|${exerciseId}`;
  const [edit, setEdit] = useState<{ owner: string; draft: SetupDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const stored = toDraft(note?.setup);
  const draft = edit?.owner === owner ? edit.draft : stored;
  const dirty = edit?.owner === owner && !sameSetup(edit.draft, stored);
  const hasStored = normalizeSetup(stored) !== null;
  const disabled = !writer || !profileId || loading;

  async function write(next: SetupDraft) {
    if (!writer || !profileId) return;
    setSaving(true);
    try {
      const value = normalizeSetup(next);
      await writer.setSetup(profileId, exerciseId, value);
      setEdit({ owner, draft: toDraft(value ?? undefined) });
      addToast(t(value ? 'ex_setup_saved' : 'ex_setup_cleared'), 'success');
    } catch {
      addToast(t('ex_setup_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title={t('ex_setup')} id="ex-setup" testId="exercise-setup">
      <form
        aria-label={t('ex_setup_label', { name: exerciseName })}
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) void write(draft);
        }}
      >
        {!writer && (
          <p className="mb-2 text-xs text-fg-muted" data-testid="exercise-setup-unavailable">
            {t('ex_setup_unavailable')}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SETUP_FIELDS.map((f) => (
            <div key={f} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${baseId}-${f}`} className="text-xs text-fg-muted">
                {t(FIELD_KEYS[f])}
              </label>
              <input
                id={`${baseId}-${f}`}
                data-testid={`exercise-setup-${f}`}
                type="text"
                value={draft[f]}
                maxLength={SETUP_MAX}
                disabled={disabled}
                onChange={(e) => setEdit({ owner, draft: { ...draft, [f]: e.target.value } })}
                className={inputCls}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" size="sm" disabled={disabled || !dirty} loading={saving} data-testid="exercise-setup-save">
            {t('ex_setup_save')}
          </Button>
          {hasStored && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || saving} onClick={() => void write(toDraft(undefined))} data-testid="exercise-setup-clear">
              {t('ex_setup_clear')}
            </Button>
          )}
        </div>
      </form>
    </SectionCard>
  );
}
