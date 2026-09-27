'use client';
import { useEffect, useRef, useState } from 'react';
import { SearchBar } from '@/components/ui/search-bar';
import { useT } from '@/lib/i18n/use-t';
import '@/lib/i18n/packs/exercises';

const DEBOUNCE_MS = 300;

interface LibrarySearchProps {
  /** Committed query (from the URL). */
  value: string;
  onCommit: (q: string) => void;
}

/**
 * Search input with a 300 ms debounce; the timer is cleared on unmount and
 * whenever the URL changes from outside (so a pending keystroke never
 * resurrects a query the user just cleared). The debounced commit always
 * calls the latest `onCommit`, so it never overwrites filters changed while
 * the timer was pending.
 */
export function LibrarySearch({ value, onCommit }: LibrarySearchProps) {
  const { t } = useT();
  const [input, setInput] = useState(value);
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  const [external, setExternal] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCommit = useRef(onCommit);

  useEffect(() => {
    latestCommit.current = onCommit;
  });

  // The URL changed from outside (clear filters, back navigation): follow it.
  if (seen !== value) {
    setSeen(value);
    if (value !== sent) {
      setInput(value);
      setSent(value);
      setExternal((n) => n + 1);
    }
  }

  // An outside change wins over a keystroke still waiting for its debounce.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, [external]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function change(next: string) {
    setInput(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const commit = () => {
      timer.current = null;
      setSent(next);
      latestCommit.current(next);
    };
    if (next === '') commit();
    else timer.current = setTimeout(commit, DEBOUNCE_MS);
  }

  return <SearchBar value={input} onChange={change} placeholder={t('ex_search_placeholder')} />;
}
