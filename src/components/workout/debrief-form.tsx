'use client';
import { useId, useState } from 'react';
import type { WorkoutDraft, WorkoutDebrief } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { summarizeDraft } from '@/stores/workout-selectors';

export interface DebriefFormProps {
  draft: WorkoutDraft;
  /** Persists the workout; a rejection keeps the draft and shows the error. */
  onSave: (debrief: WorkoutDebrief) => Promise<void>;
}

const RPE_MIN = 1;
const RPE_MAX = 10;

function parseRpe(text: string): number | undefined {
  const n = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(n)) return undefined;
  return Math.min(RPE_MAX, Math.max(RPE_MIN, Math.round(n)));
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
      <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p data-testid={testId} className="font-mono text-2xl font-bold text-[var(--highlight)]">
        {value}
      </p>
    </div>
  );
}

export function DebriefForm({ draft, onSave }: DebriefFormProps) {
  const { t } = useLocale();
  const rpeId = useId();
  const notesId = useId();
  const [rpeText, setRpeText] = useState('');
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const summary = summarizeDraft(draft);

  async function save() {
    setSaving(true);
    setFailed(false);
    const trimmed = notes.trim();
    try {
      await onSave({ rpe: parseRpe(rpeText), notes: trimmed === '' ? undefined : trimmed });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('debrief_exercises')} value={String(summary.exerciseCount)} testId="debrief-exercises" />
        <Stat label={t('sets')} value={String(summary.doneSets)} testId="debrief-sets" />
        <Stat label={t('debrief_volume')} value={String(Math.round(summary.volumeKg))} testId="debrief-volume" />
      </div>

      <div>
        {/* i18n: `debrief_rpe` requested in docs/v2/requests/G1-i18n.md. */}
        <label htmlFor={rpeId} className="mb-1 block text-xs uppercase tracking-widest text-[var(--text-muted)]">
          {t('debrief_title')} ({RPE_MIN}–{RPE_MAX})
        </label>
        <input
          id={rpeId}
          type="number"
          inputMode="numeric"
          min={RPE_MIN}
          max={RPE_MAX}
          step={1}
          value={rpeText}
          data-testid="debrief-rpe"
          onChange={(e) => setRpeText(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 font-mono text-base text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        />
      </div>

      <div>
        <label htmlFor={notesId} className="mb-1 block text-xs uppercase tracking-widest text-[var(--text-muted)]">
          {t('my_notes')}
        </label>
        <textarea
          id={notesId}
          rows={3}
          value={notes}
          placeholder={t('notes_placeholder')}
          data-testid="debrief-notes"
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        />
      </div>

      {failed && (
        <p data-testid="debrief-error" role="alert" className="rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {t('error')}
        </p>
      )}

      <Button
        data-testid="save-workout"
        size="lg"
        fullWidth
        disabled={saving}
        loading={saving}
        onClick={() => void save()}
        className="font-bold uppercase tracking-widest"
      >
        {t('debrief_save_exit')}
      </Button>
    </div>
  );
}
