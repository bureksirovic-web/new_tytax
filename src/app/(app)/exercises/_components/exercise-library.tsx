'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/use-t';
import { ActiveFilters } from './active-filters';
import { ExerciseListItem } from './exercise-list-item';
import { LibraryFilters } from './library-filters';
import { LibrarySearch } from './library-search';
import { LibraryTabs } from './library-tabs';
import { EMPTY_FILTER, hasActiveFilters, serializeLibraryParams } from './library-params';
import { useArsenal } from './use-arsenal';
import { useEquipmentOptions } from './use-equipment-options';
import { useLibraryFilter } from './use-library-filter';
import { useLibraryResults } from './use-library-results';

export const PAGE_SIZE = 30;

/** /exercises: the whole lazy catalog, searchable and filterable, with the Arsenal tab. */
export function ExerciseLibrary() {
  const { t, locale } = useT();
  const { filter, setFilter } = useLibraryFilter();
  const arsenal = useArsenal();
  const equipment = useEquipmentOptions();
  const { exercises, loading, error, retry } = useLibraryResults(filter, arsenal.ids, locale);
  const query = serializeLibraryParams(filter);
  // Pagination resets whenever the query changes (state keyed by the query).
  const [paging, setPaging] = useState({ query, visible: PAGE_SIZE });
  const visible = paging.query === query ? paging.visible : PAGE_SIZE;
  // Remounting the search box on "clear" also drops a keystroke still waiting for its debounce.
  const [searchKey, setSearchKey] = useState(0);
  const clearAll = () => {
    setSearchKey((k) => k + 1);
    setFilter({ ...EMPTY_FILTER, favorites: filter.favorites });
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-fg-2">{t('ex_load_error')}</p>
        <Button variant="secondary" onClick={retry}>{t('ex_retry')}</Button>
      </div>
    );
  } else if (!exercises) {
    body = (
      <div className="flex flex-col gap-2" aria-busy="true">
        <span className="sr-only">{t('ex_loading')}</span>
        {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  } else if (exercises.length === 0) {
    body =
      filter.favorites && !hasActiveFilters(filter) ? (
        <EmptyState icon="☆" title={t('ex_arsenal_empty_title')} description={t('ex_arsenal_empty_desc')} />
      ) : (
        <EmptyState
          title={t('ex_empty_title')}
          description={t('ex_empty_desc')}
          action={{ label: t('ex_clear_filters'), onClick: clearAll }}
        />
      );
  } else {
    const shown = exercises.slice(0, visible);
    const remaining = exercises.length - shown.length;
    body = (
      <>
        <ul className="flex flex-col gap-2" data-testid="exercise-list">
          {shown.map((e) => (
            <ExerciseListItem
              key={e.id}
              exercise={e}
              favourite={arsenal.ids?.has(e.id) ?? false}
              favouriteDisabled={!arsenal.ids || !arsenal.profileId}
              onToggleFavourite={arsenal.toggle}
              backQuery={query}
            />
          ))}
        </ul>
        <p className="mt-3 text-center text-xs text-fg-muted">{t('ex_showing', { shown: shown.length, total: exercises.length })}</p>
        {remaining > 0 && (
          <Button variant="secondary" fullWidth className="mt-2" onClick={() => setPaging({ query, visible: visible + PAGE_SIZE })}>
            {t('ex_load_more', { n: remaining })}
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 data-testid="page-heading-exercises" className="font-display text-2xl font-bold uppercase tracking-wider text-highlight">
        {t('ex_title')}
      </h1>
      <LibraryTabs favorites={filter.favorites} arsenalCount={arsenal.ids?.size} onChange={(favorites) => setFilter({ favorites })} />
      <div role="search" className="flex flex-col gap-3">
        <LibrarySearch key={searchKey} value={filter.q} onCommit={(q) => setFilter({ q })} />
        <LibraryFilters filter={filter} setFilter={setFilter} equipment={equipment} />
        <ActiveFilters filter={filter} setFilter={setFilter} onClearAll={clearAll} />
      </div>
      <p role="status" aria-live="polite" className="text-xs text-fg-muted">
        {exercises && !loading ? t('ex_results', { n: exercises.length }) : ''}
      </p>
      <section aria-label={t('ex_title')}>{body}</section>
    </div>
  );
}
