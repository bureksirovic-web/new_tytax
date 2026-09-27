'use client';
import { useId, useState, type FormEvent } from 'react';
import type { MachineSetup } from '@/contracts/domain';
import { SETUP_FIELD_MAX, SETUP_FIELDS, type SaveSetupResult } from '@/stores/setup-adapter';
import { Button } from '@/components/ui/button';
import { PICKER_INPUT_CLASS, PickerDialog } from './picker-dialog';
import { useSetupStrings } from './strings/setup';

export interface SetupSheetProps {
  exerciseName: string;
  setup: MachineSetup | undefined;
  /** False: the repository cannot store a setup; the sheet is read-only. */
  canSave: boolean;
  onSave: (setup: MachineSetup | undefined) => Promise<SaveSetupResult>;
  onClose: () => void;
}

type Field = (typeof SETUP_FIELDS)[number];
type Status = 'idle' | 'saving' | 'unsupported' | 'error';

function initialValues(setup: MachineSetup | undefined): Record<Field, string> {
  const out = {} as Record<Field, string>;
  for (const field of SETUP_FIELDS) out[field] = setup?.[field] ?? '';
  return out;
}

/**
 * Quick-edit sheet for an exercise's machine setup (modal: PickerDialog, so
 * `useDialogFocus` traps focus, Escape closes, focus returns to the opener).
 * Enter in any field saves; a saved setup closes the sheet. When the repo has
 * no setup writer (`canSave` false, or a save answers 'unsupported') the
 * fields turn read-only and a notice explains why.
 */
export function SetupSheet({ exerciseName, setup, canSave, onSave, onClose }: SetupSheetProps) {
  const t = useSetupStrings();
  const idBase = useId();
  const [values, setValues] = useState(() => initialValues(setup));
  const [status, setStatus] = useState<Status>(canSave ? 'idle' : 'unsupported');
  const readOnly = status === 'unsupported';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (readOnly || status === 'saving') return;
    setStatus('saving');
    let result: SaveSetupResult;
    try {
      result = await onSave(values);
    } catch (error) {
      result = { saved: false, reason: 'error', error };
    }
    if (result.saved) onClose();
    else setStatus(result.reason);
  }

  return (
    <PickerDialog
      title={t('setup_sheet_title', { name: exerciseName })}
      testId="setup-sheet"
      closeTestId="setup-sheet-close"
      onClose={onClose}
      busy={status === 'saving'}
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 pb-1" noValidate>
        {readOnly && (
          <p data-testid="setup-readonly" role="status" className="rounded-lg border border-[var(--border-color)] p-3 text-sm text-[var(--text-secondary)]">
            {t('setup_readonly')}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {SETUP_FIELDS.map((field) => (
            <div key={field} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${idBase}-${field}`} className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                {t(`setup_${field}`)}
              </label>
              <input
                id={`${idBase}-${field}`}
                data-testid={`setup-${field}`}
                type="text"
                autoComplete="off"
                maxLength={SETUP_FIELD_MAX}
                readOnly={readOnly}
                value={values[field]}
                onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                className={PICKER_INPUT_CLASS}
              />
            </div>
          ))}
        </div>
        {!readOnly && <p className="text-xs text-[var(--text-muted)]">{t('setup_hint')}</p>}
        {status === 'error' && (
          <p data-testid="setup-error" role="alert" className="text-sm text-[var(--highlight)]">
            {t('setup_error')}
          </p>
        )}
        <Button
          type="submit"
          data-testid="setup-save"
          fullWidth
          disabled={readOnly || status === 'saving'}
          className="min-h-11 font-bold uppercase tracking-widest"
        >
          {status === 'saving' ? t('setup_saving') : t('setup_save')}
        </Button>
      </form>
    </PickerDialog>
  );
}
