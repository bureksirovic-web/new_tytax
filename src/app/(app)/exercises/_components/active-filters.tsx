'use client';
import { useT } from '@/lib/i18n/use-t';
import { attachmentKey, labelOr, modalityKey, muscleGroupKey, stationKey } from './labels';
import { hasActiveFilters, tytaxFiltersApply, type LibraryFilter } from './library-params';

const ICON_REMOVE = '✕';

interface ActiveFiltersProps {
  filter: LibraryFilter;
  setFilter: (patch: Partial<LibraryFilter>) => void;
  onClearAll: () => void;
}

const chip =
  'flex min-h-11 items-center gap-1 rounded-full border border-accent bg-bg-2 px-3 text-xs font-medium text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** One removable chip per active filter, plus "Clear filters". */
export function ActiveFilters({ filter, setFilter, onClearAll }: ActiveFiltersProps) {
  const { t } = useT();
  if (!hasActiveFilters(filter)) return null;
  const tytax = tytaxFiltersApply(filter);
  const items: Array<{ id: string; label: string; clear: Partial<LibraryFilter> }> = [];
  if (filter.q.trim()) items.push({ id: 'q', label: `“${filter.q.trim()}”`, clear: { q: '' } });
  if (filter.modality) items.push({ id: 'm', label: t(modalityKey(filter.modality)), clear: { modality: undefined } });
  if (filter.muscleGroup) items.push({ id: 'mg', label: t(muscleGroupKey(filter.muscleGroup)), clear: { muscleGroup: undefined } });
  if (tytax && filter.stationId)
    items.push({ id: 'st', label: labelOr(t, stationKey(filter.stationId), filter.stationId), clear: { stationId: undefined } });
  if (tytax && filter.attachmentId)
    items.push({ id: 'att', label: labelOr(t, attachmentKey(filter.attachmentId), filter.attachmentId), clear: { attachmentId: undefined } });

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('ex_active_filters')}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={chip}
          aria-label={t('ex_remove_filter', { name: it.label })}
          onClick={() => setFilter(it.clear)}
        >
          <span>{it.label}</span>
          <span aria-hidden="true">{ICON_REMOVE}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="min-h-11 rounded-lg px-3 text-xs font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
      >
        {t('ex_clear_filters')}
      </button>
    </div>
  );
}
