'use client';
import { use } from 'react';
import { DamagedLog, isRenderableLog } from '@/components/history/damaged-log';
import { HistoryEditor } from '@/components/history/history-editor';
import { HistoryDetailLoading, HistoryNotFound } from '@/components/history/not-found-state';
import { useHistoryLog } from '@/components/history/use-history-log';
import { isYouth } from '@/lib/training/youth';

interface Props {
  params: Promise<{ id: string }>;
}

export default function HistoryEditPage({ params }: Props) {
  const { id } = use(params);
  const { status, log, units, profile } = useHistoryLog(id);
  if (status === 'loading') return <HistoryDetailLoading />;
  if (status === 'missing' || !log) return <HistoryNotFound testId="page-heading-history-edit" />;
  if (!isRenderableLog(log)) return <DamagedLog log={log} />;
  // Keyed by log id: a different log starts a fresh draft.
  return <HistoryEditor key={log.id} log={log} units={units} hideDropFailure={isYouth(profile)} />;
}
