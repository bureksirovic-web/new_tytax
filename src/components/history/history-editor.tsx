'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Units, WorkoutLog } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUIStore } from '@/stores/ui-store';
import { useT } from '@/lib/i18n/use-t';
import { newUuid } from '@/lib/db/ids';
import { localDay } from '@/lib/utils';
import { EditorExercise } from './editor-exercise';
import { EditorMetaFields } from './editor-meta-fields';
import { fromLog, hasErrors, newSet, toPatch, validate, type EditDraft, type EditSet } from './edit-model';
import '@/lib/i18n/packs/history';

interface Props {
  log: WorkoutLog;
  units: Units;
  /** Youth mode (profile under 16): drop and failure are not offered in the set-type picker. */
  hideDropFailure?: boolean;
}

export function HistoryEditor({ log, units, hideDropFailure }: Props) {
  const { t } = useT();
  const repo = useRepo();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const initial = useMemo(() => fromLog(log, units), [log, units]);
  const [draft, setDraft] = useState<EditDraft>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [removeUid, setRemoveUid] = useState<string | null>(null);
  const today = localDay(new Date());
  const errors = validate(draft, units, today);
  const invalid = hasErrors(errors);
  const detailHref = `/history/${log.id}`;

  const update = (fn: (d: EditDraft) => EditDraft) => {
    setDraft(fn);
    setDirty(true);
  };
  const mapExercise = (uid: string, fn: (sets: EditSet[]) => EditSet[]) =>
    update((d) => ({
      ...d,
      exercises: d.exercises.map((ex) => (ex.source.uid === uid ? { ...ex, sets: fn(ex.sets) } : ex)),
    }));

  const onSave = async () => {
    if (invalid || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await repo.logs.update(log.profileId, log.id, toPatch(draft, units));
      addToast(t('hist_updated'), 'success');
      router.push(detailHref);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };
  const onCancel = () => (dirty ? setConfirmCancel(true) : router.push(detailHref));
  const removing = draft.exercises.find((ex) => ex.source.uid === removeUid);

  return (
    <>
      <form
        data-testid="history-editor"
        className="mx-auto max-w-2xl p-4 pb-24"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <Link
          href={detailHref}
          className="mb-2 inline-flex min-h-11 items-center text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
        >
          {t('hist_back_detail')}
        </Link>
        <h1
          data-testid="page-heading-history-edit"
          className="mb-4 font-display text-xl font-bold uppercase tracking-wider text-fg"
        >
          {t('hist_edit_title')}
        </h1>
        <EditorMetaFields draft={draft} errors={errors} today={today} onChange={(patch) => update((d) => ({ ...d, ...patch }))} />

        {draft.exercises.map((ex) => (
          <EditorExercise
            key={ex.source.uid}
            ex={ex}
            units={units}
            errors={errors.sets}
            onSetChange={(setId, patch) =>
              mapExercise(ex.source.uid, (sets) => sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)))
            }
            onRemoveSet={(setId) => mapExercise(ex.source.uid, (sets) => sets.filter((s) => s.id !== setId))}
            onAddSet={() => mapExercise(ex.source.uid, (sets) => [...sets, newSet({ ...ex, sets }, newUuid())])}
            onRemoveExercise={() => setRemoveUid(ex.source.uid)}
            hideDropFailure={hideDropFailure}
          />
        ))}

        <div role="status" aria-live="polite" className="min-h-5 text-sm text-fg-2">
          {invalid ? t('hist_edit_invalid') : failed ? t('hist_action_failed') : ''}
        </div>
        <div className="mt-3 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('hist_edit_cancel')}
          </Button>
          <Button type="submit" data-testid="history-edit-save" disabled={invalid} loading={saving}>
            {t('hist_edit_save')}
          </Button>
        </div>
      </form>

      {/* Outside the form: dialog buttons must never submit it. */}
      <ConfirmDialog
        open={confirmCancel}
        title={t('hist_edit_discard_title')}
        message={t('hist_edit_discard_confirm')}
        confirmLabel={t('hist_edit_discard')}
        danger
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => router.push(detailHref)}
      />
      <ConfirmDialog
        open={removing !== undefined}
        title={t('hist_edit_remove_exercise')}
        message={removing ? t('hist_edit_remove_exercise_confirm', { name: removing.source.exerciseName }) : ''}
        confirmLabel={t('hist_edit_remove_exercise')}
        danger
        onCancel={() => setRemoveUid(null)}
        onConfirm={() => {
          update((d) => ({ ...d, exercises: d.exercises.filter((ex) => ex.source.uid !== removeUid) }));
          setRemoveUid(null);
        }}
      />
    </>
  );
}
