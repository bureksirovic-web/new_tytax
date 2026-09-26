'use client';
import { useEffect, useId, useState } from 'react';
import type { Exercise } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';
import { useLocale } from '@/components/providers';
import { CloseIcon } from './icons';

export interface ExercisePickerProps {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 150;
const RESULT_LIMIT = 30;

interface SearchState {
  status: 'loading' | 'ready' | 'error';
  results: Exercise[];
}

/** Modal exercise search over the lazy catalog. */
export function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const { t } = useLocale();
  const titleId = useId();
  const [text, setText] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'loading', results: [] });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      catalog
        .search({ text, limit: RESULT_LIMIT })
        .then((results) => {
          if (!cancelled) setSearch({ status: 'ready', results });
        })
        .catch(() => {
          if (!cancelled) setSearch({ status: 'error', results: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleText(next: string) {
    setText(next);
    // Drop stale results so nothing from the previous query can be picked.
    setSearch({ status: 'loading', results: [] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="exercise-picker"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="font-display text-lg font-bold uppercase tracking-wider text-[var(--highlight)]">
            {t('add_exercise')}
          </h2>
          <button
            type="button"
            data-testid="exercise-picker-close"
            aria-label={t('close')}
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
          >
            <CloseIcon />
          </button>
        </div>

        <input
          type="search"
          data-testid="exercise-search"
          aria-label={t('search_exercises')}
          placeholder={t('search_exercises')}
          value={text}
          autoFocus
          onChange={(e) => handleText(e.target.value)}
          className="mb-3 min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
        />

        <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={search.status === 'loading'}>
          {search.status === 'error' && (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('error')}</p>
          )}
          {search.status === 'ready' && search.results.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('no_exercises_found')}</p>
          )}
          {search.status === 'loading' && (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t('loading')}</p>
          )}
          <ul className="space-y-1">
            {search.results.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  data-testid="exercise-option"
                  data-exercise-id={ex.id}
                  onClick={() => onPick(ex)}
                  className="flex min-h-11 w-full flex-col items-start justify-center rounded-lg px-3 py-2 text-left hover:bg-[var(--bg-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
                >
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{ex.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {ex.muscleGroup.replace(/_/g, ' ')} · {ex.pattern}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
