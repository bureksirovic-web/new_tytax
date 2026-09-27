'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Locale, TranslationKey } from '@/lib/i18n';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  interpolate,
  readStoredLocale,
  translate,
  type TranslationVars,
} from './locale-core';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  // Outside a provider t() echoes the key. G4-01 proposed translating here, but
  // nothing in the app renders outside <Providers> (global-error uses no t), and
  // the programs unit tests render without a provider and query by key.
  t: (key, vars) => interpolate(key, vars),
});

const noopSubscribe = () => () => {};
/**
 * The `window.localStorage` getter itself throws a SecurityError when site data
 * is blocked (Safari private mode, some embedded webviews), so read it inside
 * the try: readStoredLocale only guards getItem.
 */
const readClientLocale = (): Locale => {
  try {
    return readStoredLocale(window.localStorage);
  } catch {
    return DEFAULT_LOCALE;
  }
};
const serverLocale = (): Locale => DEFAULT_LOCALE;

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // The server and the hydration pass render DEFAULT_LOCALE (server snapshot);
  // right after hydration React re-renders with the stored locale, so server
  // and client HTML always match. Same effect as G4-01's mount effect, without
  // a setState inside an effect (react-hooks/set-state-in-effect).
  const stored = useSyncExternalStore(noopSubscribe, readClientLocale, serverLocale);
  // A choice made on this page wins, also when storage refuses to save it.
  const [chosen, setChosen] = useState<Locale | null>(null);
  const locale = chosen ?? stored;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setChosen(l);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* storage blocked: keep the in-memory choice */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(key, locale, vars) }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
