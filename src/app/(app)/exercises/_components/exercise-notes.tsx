'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRepoQuery } from '@/hooks/use-repo';
import { getRepository } from '@/lib/db';
import { useT } from '@/lib/i18n/use-t';
import { useUIStore } from '@/stores/ui-store';
import { SectionCard } from './section-card';

const MAX = 2000;

interface ExerciseNotesProps {
  exerciseId: string;
  exerciseName: string;
  profileId: string | undefined;
}

/**
 * Personal note per profile + exercise. The edit buffer is tagged with the
 * exercise id and profile id, so it never leaks to another exercise.
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
  const text = edit?.owner === owner ? edit.text : (stored?.content ?? '');
  const dirty = edit?.owner === owner && edit.text !== (stored?.content ?? '');

  async function save() {
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
      <Button variant="secondary" size="sm" className="mt-2" disabled={!dirty} loading={saving} onClick={() => void save()}>
        {t('ex_notes_save')}
      </Button>
    </SectionCard>
  );
}
