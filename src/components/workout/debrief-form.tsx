'use client';
import { useId, useRef, useState } from 'react';
import type { WorkoutDraft, WorkoutDebrief } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { DebriefSummary } from '@/components/workout/debrief-summary';
import { DebriefRpeField, parseRpe } from '@/components/workout/debrief-rpe-field';
import { DiscardWorkoutButton } from '@/components/workout/discard-workout-button';
import { useFinishStrings } from '@/components/workout/strings/finish';
import { summarizeDraft } from '@/stores/workout-selectors';
import '@/lib/i18n/packs/g3Workout';

export { parseRpe } from '@/components/workout/debrief-rpe-field';

export interface DebriefFormProps {
  draft: WorkoutDraft;
  /**
   * Persists the workout. A rejection keeps the draft and shows the error;
   * a resolve keeps the button disabled (the page navigates away).
   */
  onSave: (debrief: WorkoutDebrief) => Promise<void>;
  /** Drops the draft (confirmed). Offered instead of saving when no set is done. */
  onDiscard: () => void;
}

export function DebriefForm({ draft, onSave, onDiscard }: DebriefFormProps) {
  const locale = useLocale();
  const t = useFinishStrings();
  // A workout without a done working set is not saved (no empty log, no rotation advance).
  const empty = summarizeDraft(draft).doneSets === 0;
  const notesId = useId();
  const [rpeText, setRpeText] = useState('');
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Synchronous guard: a double click lands before `saving` re-renders the button.
  const inFlight = useRef(false);

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    const trimmed = notes.trim();
    try {
      await onSave({ rpe: parseRpe(rpeText), notes: trimmed === '' ? undefined : trimmed });
    } catch {
      inFlight.current = false;
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <DebriefSummary draft={draft} />
      <DebriefRpeField value={rpeText} onChange={setRpeText} />

      <div>
        <label htmlFor={notesId} className="mb-1 block text-xs uppercase tracking-widest text-[var(--text-muted)]">
          {locale.t('my_notes')}
        </label>
        <textarea
          id={notesId}
          rows={3}
          value={notes}
          placeholder={locale.t('notes_placeholder')}
          data-testid="debrief-notes"
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        />
      </div>

      {failed && (
        <p data-testid="debrief-error" role="alert" className="rounded-lg border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {locale.t('error')}
        </p>
      )}

      {empty ? (
        <div data-testid="debrief-empty" className="space-y-3 rounded-lg border border-[var(--border-color)] p-3">
          <p className="font-display font-bold uppercase tracking-wider text-[var(--highlight)]">{t('empty_title')}</p>
          <p className="text-sm text-[var(--text-secondary)]">{t('empty_body')}</p>
          <DiscardWorkoutButton sessionName={draft.sessionName} onDiscard={onDiscard} />
        </div>
      ) : (
        <Button
          data-testid="save-workout"
          size="lg"
          fullWidth
          disabled={saving}
          loading={saving}
          aria-busy={saving}
          onClick={() => void save()}
          className="font-bold uppercase tracking-widest"
        >
          {locale.t('debrief_save_exit')}
        </Button>
      )}
    </div>
  );
}
