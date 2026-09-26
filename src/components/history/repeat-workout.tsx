'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutLog } from '@/contracts/domain';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useT } from '@/lib/i18n/use-t';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';
import { repeatBlock, resolveStartFromLog } from './start-from-log';

export const ACTIVE_WORKOUT_PATH = '/workout/active';

const actionCls =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-50';

/** "Repeat workout" (G4-25): a new draft from this log via G3's store action; hidden while the action is absent. */
export function RepeatWorkout({ log }: { log: WorkoutLog }) {
  const { t } = useT();
  const router = useRouter();
  const hydrated = useWorkoutHydrated();
  const start = useWorkoutStore((s) => resolveStartFromLog(s));
  const draft = useWorkoutStore((s) => s.draft);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!start) return null;
  const block = repeatBlock(draft, log.profileId);

  const run = async (replace: boolean) => {
    // G3's real startFromLog replaces any draft: a draft that appeared since this
    // render (another tab) must go through the dialog, never be dropped silently.
    if (!replace && useWorkoutStore.getState().draft) {
      setAsking(true);
      return;
    }
    setAsking(false);
    setFailed(false);
    setBusy(true);
    try {
      if (replace) useWorkoutStore.getState().discard();
      const created = await start(log.profileId, log);
      if (created) router.push(ACTIVE_WORKOUT_PATH);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="history-repeat"
        disabled={!hydrated || busy}
        aria-busy={busy || undefined}
        onClick={() => (block === 'none' ? void run(false) : setAsking(true))}
        className={actionCls}
      >
        {t('hist_repeat')}
      </button>
      {failed ? (
        <p role="alert" data-testid="history-repeat-failed" className="basis-full text-sm text-fg-2">
          {t('hist_repeat_failed')}
        </p>
      ) : null}
      <Modal open={asking} onClose={() => setAsking(false)} title={t('hist_repeat_draft_title')} size="sm">
        <div data-testid="history-repeat-dialog" className="space-y-4">
          <p className="text-sm text-fg-2">
            {block === 'foreign-draft' ? t('hist_repeat_foreign') : t('hist_repeat_draft_msg')}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
              {t('hist_edit_cancel')}
            </Button>
            {block === 'own-draft' ? (
              <>
                <Button variant="secondary" size="sm" data-testid="history-repeat-continue" onClick={() => router.push(ACTIVE_WORKOUT_PATH)}>
                  {t('hist_repeat_continue')}
                </Button>
                <Button variant="danger" size="sm" data-testid="history-repeat-replace" onClick={() => void run(true)}>
                  {t('hist_repeat_replace')}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
