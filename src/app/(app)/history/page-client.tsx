'use client';
import { HistoryList } from '@/components/history/history-list';
import { UndoSnackbar } from '@/components/history/undo-snackbar';
import { useT } from '@/lib/i18n/use-t';

export default function HistoryPage() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-2 pt-2">
        <h1
          data-testid="page-heading-history"
          className="font-display text-2xl font-bold uppercase tracking-wider text-fg"
        >
          {t('hist_title')}
        </h1>
      </header>
      <HistoryList />
      <UndoSnackbar />
    </div>
  );
}
