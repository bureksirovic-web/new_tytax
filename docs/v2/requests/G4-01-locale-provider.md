# G4-01: LocaleProvider uses the hr default and interpolation from `src/lib/i18n`

- **Requester:** G4 (owns `src/lib/i18n/**`)
- **Owner of target file:** G5 (`src/components/providers/locale-provider.tsx`)
- **Why:** AC14 / D3 make Croatian the default. Today the provider hard-codes `'en'`. Its context default `t` returns the raw key, so any component rendered outside the provider (tests, `global-error`) shows keys. It also reads `localStorage` inside a `useState` initialiser. The server therefore renders one locale and the client hydrates another, which causes a hydration mismatch. Finally, `t` has no `{vars}` support, although the dictionary uses `{n}`.
- **Change:** replace the file with the version below. `t` gains an optional third argument, and existing callers stay valid.

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  t as translate,
  type Locale,
  type TranslationKey,
  type TranslationVars,
} from '@/lib/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translate(key, DEFAULT_LOCALE, vars),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Render the default on the server and first client pass, then adopt the stored
  // locale after mount: no hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale(typeof window === 'undefined' ? undefined : window.localStorage);
    if (stored !== DEFAULT_LOCALE) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* storage blocked: keep in-memory choice */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(key, locale, vars) }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
```

- **Interim (G4 side):** none needed. Existing `t(key)` calls keep compiling. Until this lands, G4 screens pass variables through `interpolate()` from `@/lib/i18n`.
- **Note for G2:** when profile settings persist `language`, the provider should prefer the active profile's `settings.language` over localStorage. That is a follow-up once the repo contract is merged.
