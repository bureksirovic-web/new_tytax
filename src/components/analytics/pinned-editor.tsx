'use client';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import type { TrainedExercise } from './exercise-series';
import '@/lib/i18n/packs/analytics';

interface Props {
  open: boolean;
  initial: readonly string[];
  exercises: readonly TrainedExercise[];
  max: number;
  saving?: boolean;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

/** Choose up to `max` exercises (by id, from history) to pin. Mount with a fresh `key` per open. */
export function PinnedEditor({ open, initial, exercises, max, saving, onSave, onClose }: Props) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>(() => initial.filter((id) => exercises.some((e) => e.id === id)).slice(0, max));
  const full = selected.length >= max;

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= max ? cur : [...cur, id]));

  return (
    <Modal open={open} onClose={onClose} title={t('ana_edit_pinned')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(selected);
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm text-fg-2">{t('ana_pin_limit', { max })}</legend>
          {exercises.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('ana_pinned_no_history')}</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {exercises.map((e) => {
                const checked = selected.includes(e.id);
                return (
                  <li key={e.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-fg hover:bg-card-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-od-green-500"
                        checked={checked}
                        disabled={!checked && full}
                        onChange={() => toggle(e.id)}
                      />
                      {e.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
        <p className="mt-3 text-xs text-fg-muted" role="status">
          {t('ana_pinned_selected', { count: selected.length, max })}
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {t('ana_save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
