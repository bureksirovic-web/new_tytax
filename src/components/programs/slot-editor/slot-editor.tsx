'use client';
import { useState } from 'react';
import type { Program, ProgramSession } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/use-t';
import { LiveLoadDock } from './live-load-dock';
import { SlotFilters } from './slot-filters';
import { SlotResults } from './slot-results';
import { useSlotEditor } from './use-slot-editor';

interface SlotEditorProps {
  program: Program;
  session: ProgramSession;
  profileId: string;
  /** Persist the chosen exercise ids (in order); resolves false on failure. */
  onSave: (selectedIds: string[], lookup: ReturnType<typeof useSlotEditor>['lookup']) => Promise<boolean>;
  onExit: () => void;
}

/** Legacy EDITOR view: pick exercises for one session from the lazy catalog. Mount with key={session.id}. */
export function SlotEditor({ program, session, profileId, onSave, onExit }: SlotEditorProps) {
  const { t } = useT();
  const ed = useSlotEditor(program, session, profileId);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave(ed.selected, ed.lookup);
    setSaving(false);
    if (ok) onExit();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (ed.dirty ? setConfirmLeave(true) : onExit())}
          className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true">←</span> {t('prog_builder_back')}
        </button>
        <Button size="sm" variant="secondary" disabled={ed.selected.length < 2 || !ed.catalog} onClick={ed.sortByStation}>
          {t('prog_slot_sort')}
        </Button>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">{t('prog_slot_editing')}</p>
      <h1 data-testid="page-heading-program-session" className="mb-1 font-display text-2xl font-bold uppercase tracking-wide text-highlight">
        {session.name}
      </h1>
      <p className="mb-4 text-sm text-fg-muted">{program.name}</p>

      {ed.catalogError ? (
        <p role="alert" className="rounded-xl border border-red-700 p-4 text-sm text-red-300">
          {t('prog_slot_catalog_error')}
        </p>
      ) : ed.catalogLoading || !ed.catalog ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">{t('prog_loading')}</span>
          <Skeleton className="h-11" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <>
          <SlotFilters ed={ed} />
          <div className="mt-4">
            <SlotResults ed={ed} />
          </div>
          <LiveLoadDock ed={ed} saving={saving} onSave={() => void save()} />
        </>
      )}

      <ConfirmDialog
        open={confirmLeave}
        title={t('prog_slot_editing')}
        message={t('prog_slot_discard_confirm')}
        confirmLabel={t('prog_slot_leave')}
        cancelLabel={t('prog_cancel')}
        danger
        onConfirm={() => {
          setConfirmLeave(false);
          onExit();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
