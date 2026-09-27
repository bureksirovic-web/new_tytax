'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WorkoutLog } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { isValidLogRow } from '@/components/settings/backup-validate';
import { TrashIcon } from './icons';
import { useHistoryUndo } from './undo-store';
import '@/lib/i18n/packs/history';

/** False for a stored row the history views cannot render (an unvalidated restore). */
export const isRenderableLog = (log: WorkoutLog): boolean => isValidLogRow(log);

function useDamagedName(log: WorkoutLog): string {
  const { t } = useT();
  const raw: unknown = log.sessionName;
  return typeof raw === 'string' && raw.trim() !== '' ? raw : t('hist_damaged');
}

const btn =
  'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm text-fg-2 hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight';

/** List row for a damaged log: name, explanation and a working delete. */
export function DamagedCard({ log, onDelete }: { log: WorkoutLog; onDelete: (log: WorkoutLog) => void }) {
  const { t } = useT();
  const name = useDamagedName(log);
  return (
    <li data-testid="history-item-damaged" data-log-id={log.id} className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-fg">{name}</p>
        <p className="mt-0.5 text-xs text-fg-muted">{t('hist_damaged')}</p>
      </div>
      <button type="button" aria-label={t('hist_delete_damaged', { name })} onClick={() => onDelete(log)} className={btn}>
        <TrashIcon />
      </button>
    </li>
  );
}

/** Detail/edit page body for a damaged log: explains it and offers delete (with undo). */
export function DamagedLog({ log }: { log: WorkoutLog }) {
  const { t } = useT();
  const repo = useRepo();
  const remove = useHistoryUndo((s) => s.remove);
  const router = useRouter();
  const name = useDamagedName(log);
  const [failed, setFailed] = useState(false);
  const onDelete = async () => {
    setFailed(false);
    try {
      await remove(repo, log.profileId, log.id);
      router.replace('/history');
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-4 pt-20 text-center">
      <h1 data-testid="page-heading-history-detail" className="font-display text-xl font-bold uppercase tracking-wider text-fg">
        {name}
      </h1>
      <ul className="w-full text-left">
        <DamagedCard log={log} onDelete={() => void onDelete()} />
      </ul>
      <p className="text-sm text-fg-muted">{t('hist_damaged_desc')}</p>
      {failed ? <p role="alert" className="text-sm text-fg-2">{t('hist_action_failed')}</p> : null}
      <Link href="/history" className={`${btn} border border-line`}>
        {t('hist_back')}
      </Link>
    </div>
  );
}
