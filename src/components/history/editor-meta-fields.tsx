'use client';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/use-t';
import type { EditDraft, EditErrors } from './edit-model';

interface Props {
  draft: EditDraft;
  errors: EditErrors;
  today: string;
  onChange: (patch: Partial<Pick<EditDraft, 'date' | 'sessionName' | 'rpe' | 'notes'>>) => void;
}

/** Date, session name, RPE and notes of a finished log. */
export function EditorMetaFields({ draft, errors, today, onChange }: Props) {
  const { t } = useT();
  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
      <Input
        type="date"
        label={t('hist_edit_date')}
        value={draft.date}
        max={today}
        error={errors.date ? t('hist_edit_invalid') : undefined}
        onChange={(e) => onChange({ date: e.target.value })}
      />
      <Input
        label={t('hist_edit_session_name')}
        value={draft.sessionName}
        onChange={(e) => onChange({ sessionName: e.target.value })}
      />
      <Input
        label={t('hist_edit_rpe')}
        inputMode="numeric"
        value={draft.rpe}
        error={errors.rpe ? t('hist_edit_invalid') : undefined}
        onChange={(e) => onChange({ rpe: e.target.value })}
      />
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label
          htmlFor="history-edit-notes"
          className="font-display text-xs font-medium uppercase tracking-wider text-fg-muted"
        >
          {t('hist_edit_notes')}
        </label>
        <textarea
          id="history-edit-notes"
          rows={3}
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="min-h-11 w-full rounded-lg border border-line bg-bg-2 p-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
        />
      </div>
    </div>
  );
}
