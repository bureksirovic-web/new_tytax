'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useT } from '@/lib/i18n/use-t';
import type { ForeignDraft } from './use-foreign-draft';
import '@/lib/i18n/packs/dashboard';

/**
 * A workout draft of another profile (G3-04): never offered as "continue".
 * The user can switch to the owner (when it still exists) or discard it after a confirmation.
 */
export function ForeignDraftCard({ foreign }: { foreign: ForeignDraft }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const { draft, owner } = foreign;
  const session = draft.sessionName;

  const discard = () => {
    setConfirming(false);
    foreign.discard();
  };

  return (
    <div data-testid="dash-foreign-draft" className="space-y-3">
      <p role="status" data-testid="dash-foreign-title" className="font-semibold text-highlight">
        {owner ? t('dash_foreign_title', { name: owner.name }) : t('dash_foreign_title_unknown')}
      </p>
      <p className="text-sm text-fg-2">
        {owner === null ? t('dash_foreign_body_gone', { session }) : t('dash_foreign_body', { session })}
      </p>
      {owner && (
        <Button
          fullWidth
          data-testid="dash-foreign-switch"
          loading={foreign.switching}
          onClick={() => void foreign.switchToOwner()}
        >
          {t('dash_foreign_switch', { name: owner.name })}
        </Button>
      )}
      <Button variant="secondary" fullWidth data-testid="dash-foreign-discard" onClick={() => setConfirming(true)}>
        {t('dash_foreign_discard')}
      </Button>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('dash_foreign_discard_title')} size="sm">
        <div className="space-y-4" data-testid="dash-foreign-discard-dialog">
          <p className="text-sm text-fg-2">{t('dash_foreign_discard_text', { session })}</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" data-testid="dash-foreign-discard-cancel" onClick={() => setConfirming(false)}>
              {t('dash_foreign_discard_cancel')}
            </Button>
            <Button variant="danger" size="sm" data-testid="dash-foreign-discard-confirm" onClick={discard}>
              {t('dash_foreign_discard_confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
