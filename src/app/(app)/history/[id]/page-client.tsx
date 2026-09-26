'use client';
import { use } from 'react';
import { HistoryDetail } from '@/components/history/history-detail';
import { HistoryDetailLoading, HistoryNotFound } from '@/components/history/not-found-state';
import { UndoSnackbar } from '@/components/history/undo-snackbar';
import { useHistoryLog } from '@/components/history/use-history-log';
import { useHistoryUndo } from '@/components/history/undo-store';

interface Props {
  params: Promise<{ id: string }>;
}

export default function HistoryDetailPage({ params }: Props) {
  const { id } = use(params);
  const { status, log, units, programName } = useHistoryLog(id);
  // Just deleted from this page: the redirect to /history is on its way, so
  // the live query's "missing" must not flash "Workout not found" first.
  const justDeleted = useHistoryUndo((s) => s.pending?.logId === id);
  const view = status === 'missing' && justDeleted ? 'loading' : status;
  return (
    <>
      {view === 'loading' ? <HistoryDetailLoading /> : null}
      {view === 'missing' ? <HistoryNotFound /> : null}
      {view === 'ready' && log ? <HistoryDetail log={log} units={units} programName={programName} /> : null}
      <UndoSnackbar />
    </>
  );
}
