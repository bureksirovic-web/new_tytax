'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useRepoQuery } from '@/hooks/use-repo';
import { getRepository } from '@/lib/db';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { SectionCard } from './section-card';
import { normalizeSetup, toDraft } from './setup-adapter';

const MAX = 2000;

interface ExerciseNotesProps {
  exerciseId: string;
  exerciseName: string;
  profileId: string | undefined;
}

/**
 * Personal note per profile + exercise. The edit buffer is tagged with the
 * exercise id and profile id, so it never leaks to another exercise.
 * The machine setup lives on the same row and `notes.set(…, '')` removes the
 * whole row (G4-W2-55), so clearing the note while a setup exists asks first.
 */
export function ExerciseNotes({ exerciseId, exerciseName, profileId }: ExerciseNotesProps) {
  const { t } = useT();
  const inputId = useId();
  const addToast = useUIStore((s) => s.addToast);
  const { data: stored, loading } = useRepoQuery(
    (repo) => (profileId ? repo.notes.get(profileId, exerciseId) : Promise.resolve(undefined)),
    [profileId, exerciseId],
  );
  const owner = `${profileId ?? ''}|${exerciseId}`;
  const [edit, setEdit] = useState<{ owner: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const text = edit?.owner === owner ? edit.text : (stored?.content ?? '');
  const dirty = edit?.owner === owner && edit.text !== (stored?.content ?? '');
  const losesSetup = text.trim() === '' && normalizeSetup(toDraft(stored?.setup)) !== null;

  function requestSave() {
    if (losesSetup) setConfirming(true);
    else void save();
  }

  async function save() {
    setConfirming(false);
    if (!profileId) return;
    setSaving(true);
    try {
      const content = text.trim();
      await getRepository().notes.set(profileId, exerciseId, content);
      // Keep the saved text as the buffer (no flash of the old note before the live query refires).
      setEdit({ owner, text: content });
      addToast(t('ex_notes_saved'), 'success');
    } catch {
      addToast(t('ex_notes_error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title={t('ex_notes')} id="ex-notes" testId="exercise-notes">
      <label htmlFor={inputId} className="sr-only">
        {t('ex_notes_label', { name: exerciseName })}
      </label>
      <textarea
        id={inputId}
        value={text}
        maxLength={MAX}
        rows={3}
        disabled={!profileId || loading}
        placeholder={t('ex_notes_placeholder')}
        onChange={(e) => setEdit({ owner, text: e.target.value })}
        className="w-full resize-y rounded-lg border border-line bg-bg-2 p-3 text-sm text-fg placeholder:text-fg-muted focus:border-od-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-od-green-500/50"
      />
      <Button variant="secondary" size="sm" className="mt-2" disabled={!dirty} loading={saving} onClick={requestSave}>
        {t('ex_notes_save')}
      </Button>
      <ConfirmDialog
        open={confirming}
        danger
        title={t('ex_notes_clear_title')}
        message={t('ex_notes_clear_setup_msg')}
        confirmLabel={t('ex_notes_clear_confirm')}
        onConfirm={() => void save()}
        onCancel={() => setConfirming(false)}
      />
    </SectionCard>
  );
}
