'use client';
import { use } from 'react';
import { HistoryEditor } from '@/components/history/history-editor';
import { HistoryDetailLoading, HistoryNotFound } from '@/components/history/not-found-state';
import { useHistoryLog } from '@/components/history/use-history-log';

interface Props {
  params: Promise<{ id: string }>;
}

export default function HistoryEditPage({ params }: Props) {
  const { id } = use(params);
  const { status, log, units } = useHistoryLog(id);
  if (status === 'loading') return <HistoryDetailLoading />;
  if (status === 'missing' || !log) return <HistoryNotFound testId="page-heading-history-edit" />;
  // Keyed by log id: a different log starts a fresh draft.
  return <HistoryEditor key={log.id} log={log} units={units} />;
}
