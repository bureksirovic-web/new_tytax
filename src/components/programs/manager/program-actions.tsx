'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useT } from '@/lib/i18n/use-t';
import '@/lib/i18n/packs/programs';

interface ProgramActionsProps {
  name: string;
  isActive: boolean;
  incomplete: boolean;
  /** Builder draft that was never activated: offer "Discard draft" instead of "Delete". */
  isDraft: boolean;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}

type Pending = 'deactivate' | 'delete' | 'discard' | null;

/** Activate (gated on completeness) / deactivate / delete / discard draft, each destructive step confirmed. */
export function ProgramActions({ name, isActive, incomplete, isDraft, busy, onActivate, onDeactivate, onDelete }: ProgramActionsProps) {
  const { t } = useT();
  const [pending, setPending] = useState<Pending>(null);

  const dialog = {
    deactivate: { title: t('prog_deactivate'), message: t('prog_deactivate_confirm'), confirm: t('prog_deactivate'), run: onDeactivate },
    delete: { title: t('prog_detail_delete'), message: t('prog_detail_delete_confirm', { name }), confirm: t('prog_delete'), run: onDelete },
    discard: { title: t('prog_builder_discard'), message: t('prog_builder_discard_confirm'), confirm: t('prog_builder_discard'), run: onDelete },
  };
  const current = pending ? dialog[pending] : null;

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button variant="secondary" disabled={busy} onClick={() => setPending('deactivate')}>
            {t('prog_deactivate')}
          </Button>
        ) : (
          <Button variant="primary" disabled={busy || incomplete} aria-describedby={incomplete ? 'prog-activate-hint' : undefined} onClick={onActivate}>
            {t('prog_activate')}
          </Button>
        )}
        {isDraft && !isActive ? (
          <Button variant="danger" disabled={busy} onClick={() => setPending('discard')}>
            {t('prog_builder_discard')}
          </Button>
        ) : (
          <Button variant="danger" disabled={busy} onClick={() => setPending('delete')}>
            {t('prog_detail_delete')}
          </Button>
        )}
      </div>
      {!isActive && incomplete ? (
        <p id="prog-activate-hint" className="mt-2 text-xs text-fg-muted">
          {t('prog_incomplete_hint')}
        </p>
      ) : null}
      <ConfirmDialog
        open={current !== null}
        title={current?.title ?? ''}
        message={current?.message ?? ''}
        confirmLabel={current?.confirm}
        cancelLabel={t('prog_cancel')}
        danger={pending !== 'deactivate'}
        onConfirm={() => {
          setPending(null);
          current?.run();
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
