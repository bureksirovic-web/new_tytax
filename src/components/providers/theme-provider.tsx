'use client';
import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'oled';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  
  if (theme === 'oled') {
    document.documentElement.setAttribute('data-theme', 'oled');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * The `window.localStorage` getter itself throws a SecurityError when site data
 * is blocked (Safari private mode, some embedded webviews): the theme then
 * falls back to 'dark' and is not remembered, instead of crashing the page.
 */
function readSavedTheme(): Theme {
  try {
    const saved = window.localStorage.getItem('theme');
    return saved === 'dark' || saved === 'oled' ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem('theme', theme);
  } catch {
    // Storage blocked or full: the choice lasts for this page only.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return readSavedTheme();
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    saveTheme(t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
